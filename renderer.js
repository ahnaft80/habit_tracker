const { ipcRenderer } = require('electron');

document.addEventListener('DOMContentLoaded', () => {
    init();
    startClock();  // Initialize the clock when the document is ready
    setToday();    // Set today's date in the calendar
    updateCalendar(); // Update the calendar when the document is ready
    updateFormattedDate(); // Format and display the date on load
    updateDisplayDate();
});

const calendarInput = document.getElementById('calendar');
calendarInput.addEventListener('change', updateDisplayDate);

document.getElementById('editHabitButton').addEventListener('click', function() {
    console.log('Edit habit button clicked');
    const editButtons = document.querySelectorAll('.edit-button');
    //editButtons.forEach(button => {
    //    button.classList.toggle('hidden'); // Toggle the 'hidden' class
    //});
});


document.getElementById('deleteHabitButton').addEventListener('click', function() {
    console.log('Delete habit button clicked');
    const deleteButtons = document.querySelectorAll('.delete-button');
    deleteButtons.forEach(button => {
        button.classList.toggle('hidden'); // Toggle the 'hidden' class
    });
});

function init() {
    const habitForm = document.getElementById('habitForm');
    const habitList = document.getElementById('habitList');
    const showFormButton = document.getElementById('showFormButton');
    const closeFormButton = document.getElementById('closeFormButton');
    const modalOverlay = document.getElementById('modalOverlay');

    if (!habitForm || !habitList || !showFormButton || !closeFormButton || !modalOverlay) {
        console.error('One or more necessary components not found!');
        return;
    }

    showFormButton.addEventListener('click', showForm);
    closeFormButton.addEventListener('click', hideForm);
    modalOverlay.addEventListener('click', hideForm);
    habitForm.addEventListener('submit', submitHabitForm);

    ipcRenderer.on('add-habit-success', handleAddHabitSuccess);
    ipcRenderer.on('add-habit-error', handleAddHabitError);
    ipcRenderer.on('get-habits-success', handleGetHabitsSuccess);
    ipcRenderer.on('get-habits-error', handleGetHabitsError);

    ipcRenderer.send('get-habits');
}

function submitHabitForm(event) {
    event.preventDefault();
    const habitName = document.getElementById('habitName').value;
    const habitDescription = document.getElementById('habitDescription').value;

    ipcRenderer.send('add-habit', { name: habitName, description: habitDescription });

    habitForm.reset();
    hideForm();
}

function handleAddHabitSuccess() {
    console.log('Habit added successfully');
    ipcRenderer.send('get-habits');
}

function handleAddHabitError(event, errorMessage) {
    console.error('Error adding habit:', errorMessage);
}

function handleGetHabitsSuccess(event, habits) {
    renderHabits(habits);
}

function handleGetHabitsError(event, errorMessage) {
    console.error('Error fetching habits:', errorMessage);
}

function renderHabits(habits) {
    const habitList = document.getElementById('habitList');
    if (!habitList) {
        console.error('Habit list element not found!');
        return;
    }

    habitList.innerHTML = '';
    habits.forEach(habit => {
        if (habit.completed !== 1) {
            const listItem = document.createElement('li');
            listItem.className = 'habit-item'; // Add a class for styling and transition

            const checkbox = document.createElement('input');
            checkbox.type = 'checkbox';
            checkbox.checked = habit.completed === 1;
            checkbox.id = `habitCheckbox_${habit.id}`;

            // Add event listener to handle checkbox click
            // Handle checkbox change
            checkbox.addEventListener('change', (event) => {
                const isChecked = event.target.checked;
                const habitId = habit.id;

                // Animate the disappearance
                listItem.style.transition = 'opacity 0.5s ease-out';
                listItem.style.opacity = '0';

                setTimeout(() => {
                    listItem.remove(); // Remove the habit after the transition
                }, 500); // Corresponds to the transition duration

                // Update the habit completion status in the backend
                ipcRenderer.send('update-habit-completion', { id: habitId, completed: isChecked });
            });

            const label = document.createElement('label');
            label.setAttribute('for', checkbox.id);
            label.textContent = habit.name; // Only set habit name as label text

            const infoButton = document.createElement('button');
            infoButton.className = 'info-button';
            infoButton.setAttribute('aria-label', 'More info');
            const infoIcon = document.createElement('i');
            infoIcon.className = 'fas fa-info-circle';
            infoButton.appendChild(infoIcon);

            infoButton.addEventListener('click', () => {
                console.log(`Information about ${habit.name}: ${habit.description}`);
                // Show the description in an alert or any other UI element
                alert(`Information about ${habit.name}:\n${habit.description}`);
            });

            listItem.appendChild(checkbox);
            listItem.appendChild(label);
            listItem.appendChild(infoButton);

            // Create an edit button for each habit
            const editButton = document.createElement('button');
            editButton.className = 'edit-button hidden'; // Start hidden
            const editIcon = document.createElement('i');
            editIcon.className = 'fas fa-edit';
            editButton.appendChild(editIcon);
            editButton.addEventListener('click', () => {
                console.log(`Editing habit: ${habit.id}`);
                // Optionally send a request to edit the habit
            });
            listItem.appendChild(editButton);

            // Create a delete button for each habit
            const deleteButton = document.createElement('button');
            deleteButton.className = 'delete-button hidden'; // Start hidden
            const icon = document.createElement('i');
            icon.className = 'fas fa-times';
            deleteButton.appendChild(icon);
            deleteButton.addEventListener('click', () => {
                console.log(`Deleting habit: ${habit.id}`);
                // Optionally send a request to delete the habit from the backend
            });
            listItem.appendChild(deleteButton);

            habitList.appendChild(listItem);
        }
    });
}

function showForm() {
    const modalOverlay = document.getElementById('modalOverlay');
    const habitForm = document.getElementById('habitForm');
    if (!modalOverlay || !habitForm) {
        console.error('Modal overlay or habit form element not found!');
        return;
    }
    modalOverlay.style.display = 'block';
    habitForm.style.display = 'block';
}

function hideForm() {
    const modalOverlay = document.getElementById('modalOverlay');
    const habitForm = document.getElementById('habitForm');
    if (!modalOverlay || !habitForm) {
        console.error('Modal overlay or habit form element not found!');
        return;
    }
    modalOverlay.style.display = 'none';
    habitForm.style.display = 'none';
}

function startClock() {
    const clockElement = document.getElementById('clock');
    console.log('Clock function is running'); // Added console log

    if (!clockElement) {
        console.error('Clock element not found!');
        return;
    }

    function updateClock() {
        const now = new Date();
        let hours = now.getHours();
        let minutes = now.getMinutes();
        let seconds = now.getSeconds();

        hours = hours < 10 ? '0' + hours : hours;
        minutes = minutes < 10 ? '0' + minutes : minutes;
        seconds = seconds < 10 ? '0' + seconds : seconds;

        clockElement.innerHTML = `
            <div class="number">${hours}</div>
            <div class="number">${minutes}</div>
            <div class="number">${seconds}</div>
        `;
    }

    updateClock();  // Update immediately to prevent delay
    setInterval(updateClock, 1000);  // Update the clock every second
}

function updateFormattedDate() {
    console.log('updateFormattedDate function is running');
    const input = document.getElementById('calendar');
    const formattedDateDiv = document.getElementById('formattedDate');
    
    console.log({input, formattedDateDiv}); // Check if these elements are null

    if (input.value) {
        const date = new Date(input.value);
        const options = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
        formattedDateDiv.textContent = date.toLocaleDateString('en-US', options);
    } else {
        formattedDateDiv.textContent = 'Select a date';
    }
}

function setToday() {
    const today = new Date().toISOString().substring(0, 10); // Get today's date in YYYY-MM-DD format
    const calendarInput = document.getElementById('calendar');
    calendarInput.value = today; // Set the default value of the date input to today
    updateFormattedDate(); // Immediately update the formatted date display
}

function updateDisplayDate() {
    const dayElement = document.querySelector('.date-day');
    const monthElement = document.querySelector('.date-month');
    const numberElement = document.querySelector('.date-number');

    if (!dayElement || !monthElement || !numberElement) {
        console.error('Date display elements not found!');
        return;
    }

    const currentDate = new Date();
    const dayName = currentDate.toLocaleDateString('en-US', { weekday: 'short' });
    const monthName = currentDate.toLocaleDateString('en-US', { month: 'short' });
    const dateNumber = currentDate.getDate();

    dayElement.textContent = dayName;
    monthElement.textContent = monthName;
    numberElement.textContent = dateNumber;
}



