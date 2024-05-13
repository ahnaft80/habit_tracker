const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const sqlite3 = require('sqlite3').verbose();

// Path to the SQLite database
const dbPath = path.resolve(__dirname, 'data', 'habits.db');
let db;

function createWindow() {
    // Create the browser window.
    const win = new BrowserWindow({
        width: 1800,
        height: 1600,
        webPreferences: {
            nodeIntegration: true,
            contextIsolation: false // Adjust this for production
        }
    });

    win.loadFile('index.html');
    //win.webContents.openDevTools(); // Open the Developer Tools for debugging

}

app.whenReady().then(() => {
    // Initialize the database connection
    initializeDatabase();
    createWindow();
    // Schedule the daily update
    scheduleDailyUpdate();
    // Check the last time an update was made and send a console message
    checkLastUpdate((lastUpdate) => {
        console.log('Last update:', lastUpdate);
    });
    logInteraction(); // Log interaction when app opens
});

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
        app.quit();
    }
});

app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
        createWindow();
    }
});

function initializeDatabase() {
    db = new sqlite3.Database(dbPath, sqlite3.OPEN_READWRITE | sqlite3.OPEN_CREATE, (err) => {
        if (err) {
            console.error('Could not connect to the database:', err.message);
            return;
        }
        console.log('Connected to the SQLite database.');

        const createHabitsTable = `
            CREATE TABLE IF NOT EXISTS habits (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT,
                description TEXT,
                creation_date DATE,
                completed INTEGER DEFAULT 0
            );
        `;

        const createCompletionLogTable = `
            CREATE TABLE IF NOT EXISTS completion_log (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                habit_id INTEGER,
                date DATE,
                day_of_week INTEGER,
                time TIME,
                completion_status INTEGER,
                FOREIGN KEY(habit_id) REFERENCES habits(id)
            );
        `;

        const createStreaksTable = `
            CREATE TABLE IF NOT EXISTS streaks (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                habit_id INTEGER,
                start_date DATE,
                end_date DATE,
                length INTEGER,
                FOREIGN KEY(habit_id) REFERENCES habits(id)
            );
        `;

        const createAppSettingsTable = `
            CREATE TABLE IF NOT EXISTS last_updates (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                last_interaction DATETIME DEFAULT CURRENT_TIMESTAMP
            );
        `;


        // Run the SQL queries to create tables
        db.serialize(() => {
            db.run(createHabitsTable, err => {
                if (err) console.error("Error creating Habits table:", err.message);
            });
            db.run(createCompletionLogTable, err => {
                if (err) console.error("Error creating Completion Log table:", err.message);
            });
            db.run(createStreaksTable, err => {
                if (err) console.error("Error creating Streaks table:", err.message);
            });
            db.run(createAppSettingsTable, err => {
                if (err) console.error("Error creating App Settings table:", err.message);
            });
        });
    });
}


// Function to create a new habit in the database
function createHabit(habitData, callback) {
    const currentDate = new Date().toISOString().split('T')[0]; // Get current date in YYYY-MM-DD format
    const sql = `INSERT INTO habits (name, description, creation_date) VALUES (?, ?, ?)`;
    db.run(sql, [habitData.name, habitData.description, currentDate], function(err) {
        callback(err, { habitId: this.lastID });
    });
}


// Function to fetch habits from the database
function getHabits(callback) {
    db.all(`SELECT * FROM habits`, (err, rows) => {
        callback(err, rows);
    });
}

function logInteraction() {
    const now = new Date();
    const localDateTime = [
        now.getFullYear(),
        (now.getMonth() + 1).toString().padStart(2, '0'),
        now.getDate().toString().padStart(2, '0')
    ].join('-') + ' ' + 
    [
        now.getHours().toString().padStart(2, '0'),
        now.getMinutes().toString().padStart(2, '0'),
        now.getSeconds().toString().padStart(2, '0')
    ].join(':');
    const sql = `INSERT INTO last_updates (last_interaction) VALUES (?)`;
    db.run(sql, [localDateTime], (err) => {
        if (err) {
            console.error('Error logging interaction:', err.message);
        } else {
            console.log('Interaction logged at:', localDateTime);
            // After logging the interaction, check and log missed updates
            //checkAndLogMissedUpdates();
        }
    });
}

function checkLastUpdate(callback) {
    const sql = `SELECT last_interaction FROM last_updates ORDER BY id DESC LIMIT 1`;
    db.get(sql, (err, row) => {
        if (err) {
            console.error('Error fetching last update:', err.message);
            return;
        }
        if (row) {
            const lastInteraction = new Date(row.last_interaction);
            const currentDate = new Date();
            const lastInteractionDate = new Date(lastInteraction.toDateString());
            const currentDateDate = new Date(currentDate.toDateString());

            if (lastInteractionDate.getTime() < currentDateDate.getTime()) {
                // Last interaction was on a previous day
                const lastInteractionTime = lastInteraction.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit', second:'2-digit'});
                if (lastInteractionTime < '23:59:59') {
                    console.log('Last update was before 23:59:59.');
                    //log finished habits
                    logUnfinishedHabitsAppNotRunning()
                } else {
                    console.log('Last update was at or after 23:59:59.')
                } 
            }
            callback(row.last_interaction);
        } else {
            console.log('No previous updates found.');
        }
    });
}

function logUnfinishedHabitsAppNotRunning() {
    const previousDate = new Date();
    previousDate.setDate(previousDate.getDate()); // Get the date for the previous day

    const dayOfWeek = previousDate.getDay(); // Previous day's day of the week

    const logUnfinishedHabitsQuery = `
        INSERT INTO completion_log (habit_id, date, day_of_week, time, completion_status)
        SELECT id, ?, ?, '23:59:59', 0 FROM habits WHERE completed = 0;
    `;

    db.run(logUnfinishedHabitsQuery, [previousDate.toISOString().split('T')[0], dayOfWeek], (err) => {
        if (err) {
            console.error('Error logging unfinished habits when app was not running:', err.message);
            return;
        }
        console.log('Unfinished habits logged for', previousDate.toISOString().split('T')[0], 'when app was not running.');
    });

    // Run SQL query to update all habits, resetting completed status to 0
    db.run(`UPDATE habits SET completed = 0`, [], (err) => {
        if (err) {
            console.error('Error resetting daily habits:', err.message);
        } else {
            console.log('All habits reset for the new day');
        }
    });
}


// IPC event handlers
ipcMain.on('add-habit', (event, habitData) => {
    createHabit(habitData, (err, result) => {
        if (err) {
            event.reply('add-habit-error', err.message);
        } else {
            event.reply('add-habit-success', result);
        }
    });
});

ipcMain.on('get-habits', (event) => {
    getHabits((err, habits) => {
        if (err) {
            event.reply('get-habits-error', err.message);
        } else {
            event.reply('get-habits-success', habits);
        }
    });
});


ipcMain.on('update-habit-completion', (event, { id, completed }) => {
    logInteraction(); // Log interaction when habit completion is updated

    const localDate = new Date();  // Get the current local date and time
    const dayOfWeek = localDate.getDay(); // Get the day of the week (0 for Sunday, 1 for Monday, ..., 6 for Saturday)
    const sqlUpdateHabit = `UPDATE habits SET completed = ? WHERE id = ?`;
    const sqlInsertCompletion = `INSERT INTO completion_log (habit_id, date, day_of_week, time, completion_status) VALUES (?, ?, ?, ?, ?)`;
    const sqlGetLastCompletion = `SELECT * FROM completion_log WHERE habit_id = ? ORDER BY date DESC LIMIT 1`;
    const sqlUpdateStreak = `UPDATE streaks SET end_date = ?, length = julianday(end_date) - julianday(start_date) WHERE id = ?`;
    const sqlInsertStreak = `INSERT INTO streaks (habit_id, start_date, end_date, length) VALUES (?, ?, ?, 0)`;
    const completionStatus = completed ? 1 : 0; // Set completion status based on habit completion

    db.serialize(() => {
        db.run(sqlUpdateHabit, [completed, id], function(err) {
            if (err) {
                console.error('Error updating habit completion status:', err.message);
                event.reply('update-habit-completion-error', { id, message: err.message });
                return;
            }
            console.log(`Habit ${id} completion status updated to ${completed}`);
            event.reply('update-habit-completion-success', { id });

            // Only log the completion if it's marked as completed
            if (completed) {
                const localDateString = [
                    localDate.getFullYear(),
                    (localDate.getMonth() + 1).toString().padStart(2, '0'), // getMonth is zero-based
                    localDate.getDate().toString().padStart(2, '0')
                ].join('-');

                const localTimeString = [
                    localDate.getHours().toString().padStart(2, '0'),
                    localDate.getMinutes().toString().padStart(2, '0'),
                    localDate.getSeconds().toString().padStart(2, '0')
                ].join(':');

                db.run(sqlInsertCompletion, [id, localDateString, dayOfWeek, localTimeString, completionStatus], err => {
                    if (err) {
                        console.error('Error logging habit completion:', err.message);
                    } else {
                        console.log(`Completion logged for habit ${id} at local time ${localTimeString}`);
                        // After updating and logging, perform the SELECT query to get the last completion date
                        db.get(sqlGetLastCompletion, [id], (err, row) => {
                            if (err) {
                                console.error('Error fetching last completion date:', err.message);
                            } else if (row) {
                                const lastCompletionDate = new Date(row.date);
                                const today = new Date();
                                if (lastCompletionDate.getDate() === today.getDate() &&
                                    lastCompletionDate.getMonth() === today.getMonth() &&
                                    lastCompletionDate.getFullYear() === today.getFullYear()) {
                                    // If the last completion was today, the streak continues
                                    console.log('Streak continues for habit', id);
                                } else {
                                    // If the last completion was not today, the streak ends and a new streak starts
                                    db.run(sqlUpdateStreak, [lastCompletionDate.toISOString().split('T')[0], id], err => {
                                        if (err) {
                                            console.error('Error updating streak end date:', err.message);
                                        } else {
                                            console.log('Streak ended for habit', id);
                                            // Start a new streak
                                            db.run(sqlInsertStreak, [id, localDateString, null], err => {
                                                if (err) {
                                                    console.error('Error starting new streak:', err.message);
                                                } else {
                                                    console.log('New streak started for habit', id);
                                                }
                                            });
                                        }
                                    });
                                }
                            } else {
                                // If there are no previous completion logs, start a new streak
                                db.run(sqlInsertStreak, [id, localDateString, null], err => {
                                    if (err) {
                                        console.error('Error starting new streak:', err.message);
                                    } else {
                                        console.log('New streak started for habit', id);
                                    }
                                });
                            }
                        });
                    }
                });
            }
        });
    });
});


// Function to schedule the daily update of habits
function scheduleDailyUpdate() {
    const now = new Date();
    let nextMidnight = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1); // Get the next midnight
    let timeout = nextMidnight - now; // Calculate the time until the next midnight
    setTimeout(() => {
        updateDailyHabits(); // Call the function to update habits
        scheduleDailyUpdate(); // Reschedule for the next day
        refreshAtMidnight(); // Call the function to refresh at midnight
    }, timeout); // Wait until the next midnight
}


// Function to refresh the database at midnight
function refreshAtMidnight() {
    const now = new Date();
    const midnight = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
    const timeUntilMidnight = midnight - now;
    
    setTimeout(() => {
        // Perform the database refresh operations here
        // For example, you can call the function to update habits or perform any other necessary actions
        updateDailyHabits(); // Example: calling the function to update habits
    }, timeUntilMidnight);
}

// Function to update habits daily
//function updateDailyHabits() {
//    const currentDate = new Date().toISOString().split('T')[0]; // Today's date in YYYY-MM-DD
//    const dayOfWeek = new Date().getDay(); // Today's day of the week
//
//    // First, log all unfinished habits with a status of 0
//    const logUnfinishedHabits = `
//        INSERT INTO completion_log (habit_id, date, day_of_week, time, completion_status)
//        SELECT id, ?, ?, '23:59:59', 0 FROM habits WHERE completed = 0;
//    `;
//
//    db.run(logUnfinishedHabits, [currentDate, dayOfWeek], (err) => {
//        if (err) {
//            console.error('Error logging unfinished habits:', err.message);
//            return;
//        }
//        console.log('Unfinished habits logged');
//    });
//
//    // Run SQL query to update all habits, resetting completed status to 0
//    db.run(`UPDATE habits SET completed = 0`, [], (err) => {
//        if (err) {
//            console.error('Error resetting daily habits:', err.message);
//        } else {
//            console.log('All habits reset for the new day');
//        }
//    });
//}


// Ensure the database connection is closed when the app is about to quit
app.on('will-quit', () => {
    db.close(() => {
        console.log('Database connection closed');
    });
});
