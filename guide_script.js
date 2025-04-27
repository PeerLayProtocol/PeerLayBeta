// Global variables
let selectedOptions = [];
let optionPercentages = [];
let eventsData = [];

// Dummy values for scoring
let gameStruct = []; // will be filled after loading events
let gameSolutions = []; // will be filled after loading events
let scoresSum = 1000000; // example dummy total score
let gamePrize = 2000000; // example dummy prize amount


document.addEventListener('DOMContentLoaded', () => {
    eventsData = [
        {
            rank: 1,
            description: "Will the Apollo 11 make it to the Moon and back successfully?",
            options: ["Yes", "No"],
            solution: 1
        },
        {
            rank: 2,
            description: "How long will the Wright brothers' first powered flight last for?",
            options: ["Less than 10 seconds", "10 to 30 seconds", "More than 30 seconds"],
            solution: 2
        },
        {
            rank: 3,
            description: "What will Columbus' 1492 expedition result in?",
            options: ["New route to India", "Ships fall off the edge", "Discovery of a new continent", "Return with no land found"],
            solution: 3 // Correct answer: Discovery of a new continent
        }
    ];
    optionPercentages = [
        [70, 30], 
        [55, 25, 20],
        [10, 50, 20, 20]     
    ];
    gameStruct = eventsData;
    gameSolutions = eventsData.map(e => e.solution || 0);

    displayGameEvents(eventsData, optionPercentages);
});

function displayGameEvents(eventsData, optionPercentages) {
    const eventContainer = document.getElementById('event-container');
    eventContainer.innerHTML = ''; // Clear existing events

    eventsData.forEach((event, eventIndex) => {
        // Create a container for each event
        const eventDiv = document.createElement('div');
        eventDiv.classList.add('event-container'); // Add a class for styling

        // Create a container to hold description and options side by side
        const eventContentDiv = document.createElement('div');
        eventContentDiv.classList.add('event-content'); // Add a class for layout

        // Description section with "Skip" option
        const descriptionDiv = document.createElement('div');
        descriptionDiv.classList.add('event-description');

        // Add "Skip" option
        const skipOptionDiv = document.createElement('div');
        skipOptionDiv.textContent = 'Skip event';
        skipOptionDiv.classList.add('skip-option');
        skipOptionDiv.dataset.eventId = eventIndex;
        skipOptionDiv.dataset.optionIndex = 0;
        skipOptionDiv.dataset.totalOptions = event.options.length;
        skipOptionDiv.addEventListener('click', () => handleOptionClick(skipOptionDiv));

        descriptionDiv.appendChild(skipOptionDiv);
        
        // Add sanitized description text
        const descriptionText = document.createTextNode(event.description);
        descriptionDiv.appendChild(descriptionText);

        eventContentDiv.appendChild(descriptionDiv);

        // Options section (without "Skip")
        const optionsDiv = document.createElement('div');
        optionsDiv.classList.add('event-options');

        event.options.forEach((option, optionIndex) => {
            const optionDiv = document.createElement('div');
            optionDiv.classList.add('optionPlusPercentage');
            const optionText = document.createElement('div');
            const percentageDiv = document.createElement('div');
            percentageDiv.classList.add('option-percentage');
            const percentage = ` ${optionPercentages[eventIndex]?.[optionIndex] || 0}%`;
            percentageDiv.textContent = `${percentage}`;
            optionText.textContent = `${option}`;
            optionText.classList.add('outcome-option', 'selectable');

            // Add 'right' class if this option is the correct solution
            if (event.solution && optionIndex === event.solution - 1) {
                optionText.classList.add('right');
            }

            optionText.dataset.eventId = eventIndex;
            optionText.dataset.optionIndex = optionIndex + 1;
            optionText.dataset.totalOptions = event.options.length;

            optionDiv.appendChild(percentageDiv);
            optionDiv.appendChild(optionText);

            optionText.addEventListener('click', () => handleOptionClick(optionText));

            // Apply collapsibility to options if the text length exceeds 40 characters
            if (option.length > 40) {
                handleCollapsibleText(optionDiv, 40);
            }

            optionsDiv.appendChild(optionDiv);
        });

        eventContentDiv.appendChild(optionsDiv);
        eventDiv.appendChild(eventContentDiv);
        
        // Add the event to the container
        eventContainer.appendChild(eventDiv);
    });
}

function handleOptionClick(optionCell) {
    const eventId = Number(optionCell.dataset.eventId);
    const optionIndex = Number(optionCell.dataset.optionIndex);
    const totalOptions = Number(optionCell.dataset.totalOptions);

    selectedOptions[eventId] = selectedOptions[eventId] || [];
    const selectedOptionsForEvent = selectedOptions[eventId];
    const isSkipEvent = optionIndex === 0;

    // Handle "Skip Event" selection
    if (isSkipEvent) {
        selectedOptions[eventId] = [0];
        document.querySelectorAll(`[data-event-id='${eventId}']`).forEach(option => option.classList.remove('selected'));
        optionCell.classList.add('selected');
        return;
    }

    // Special case: only 2 options (plus Skip)
    if (totalOptions === 2) {
        if (selectedOptionsForEvent.includes(optionIndex)) {
            // Deselect the clicked option
            selectedOptions[eventId] = [];
            optionCell.classList.remove('selected');
        } else {
            // Select the clicked option and replace the previous one
            selectedOptions[eventId] = [optionIndex];
            document.querySelectorAll(`[data-event-id='${eventId}']`).forEach(option => option.classList.remove('selected'));
            optionCell.classList.add('selected');
        }
        return;
    }

    // Handle normal option selection
    const selectedIndex = selectedOptionsForEvent.indexOf(optionIndex);
    if (selectedOptionsForEvent.includes(0)) {
        // Remove "Skip Event" if any other option is selected
        selectedOptions[eventId] = [optionIndex];
        document.querySelector(`[data-event-id='${eventId}'][data-option-index='0']`).classList.remove('selected');
        optionCell.classList.add('selected');
        return;
    }

    if (selectedIndex > -1) {
        // Deselect the clicked option
        selectedOptions[eventId].splice(selectedIndex, 1);
        optionCell.classList.remove('selected');
    } else if (selectedOptionsForEvent.length < totalOptions - 1) {
        // Select the clicked option if within limit
        selectedOptions[eventId].push(optionIndex);
        optionCell.classList.add('selected');
        document.querySelector(`[data-event-id='${eventId}'][data-option-index='0']`).classList.remove('selected');
    } else {
        // Exceeded selection limit
        showCustomAlert(`You can only select up to ${totalOptions - 1} options for this event.`, 3000);
    }

    // Allow empty selection (no auto-revert to "Skip Event")
    if (selectedOptions[eventId].length === 0) {
        selectedOptions[eventId] = []; // Explicitly allow empty array
    }

    // Sort the selected options for consistent order
    selectedOptions[eventId].sort((a, b) => a - b);
}

function calculateSingleScore(selectedOptions) {
    let score = 1; // Start with the initial score (10^18)

    // Loop through each event to calculate the score adjustments
    for (let j = 0; j < gameStruct.length; j++) {
        const eventOptions = selectedOptions[j] || []; // Options selected for the event
        const finalSolution = gameSolutions[j]; // Final solution for the event

        if ((eventOptions.length === 1 && eventOptions[0] === 0) || finalSolution === 0) {
            // Skip this event if no options are selected or no solution exists
            continue;
        }

        let multipliersSum = 0; // Sum of multipliers for selected options
        let solutionIncluded = false; // Tracks if the final solution is included in the selected options

        // Calculate the sum of multipliers and check if the solution is included
        eventOptions.forEach(option => {
            if (option === finalSolution) {
                solutionIncluded = true;
            }
            multipliersSum += optionPercentages[j][option - 1]; // Adjust for 1-based indexing
        });

        // Adjust the score based on whether the solution is included
        if (solutionIncluded) {
            score = (score * (100)) / (multipliersSum);
        } else {
            score = (score * (100 - multipliersSum)) / (100);
        }
    }

    // Divide the final score by 1e18 to convert it into a readable number
    return score;
}

document.getElementById("seeResults_btn").addEventListener("click", () => {
    try {
        // Validate if required data is available
        if (!selectedOptions || selectedOptions.length === 0) {
            showCustomAlert("No options selected. Please make your choices before viewing results.", 3000);
            return;
        }

        // Validate that there is a selection for every event
        for (let i = 0; i < gameStruct.length; i++) {
            if (!selectedOptions[i] || selectedOptions[i].length === 0) {
                showCustomAlert(`You must select an option for Event ${i + 1}, even if it's "Skip".`, 3000);
                return;
            }
        }

        // Call the score calculation function with the selected options
        const score = calculateSingleScore(selectedOptions);

        // Simulating total score from all players (you can replace this with actual data if you have multiple players)
        const totalScore = 1000000; // Example total score (you should replace it with actual total score)
        const payout = (score / totalScore) * gamePrize;

        // Display the results
        const resultDisplayElement = document.getElementById("resultDisplay");
        if (resultDisplayElement) {
            const formattedScore = (Math.round(score * 1000) / 1000).toLocaleString(undefined, {
                minimumFractionDigits: 0,
                maximumFractionDigits: 3,
            });
            const formattedPayout = (Math.round(payout * 1000) / 1000).toLocaleString().replace(',', '.'); // Change comma to dot

            resultDisplayElement.innerHTML = `
                <p><strong>Your Score:</strong> ${formattedScore}</p>
                <p><strong>Total Score (All Players):</strong> ${scoresSum}</p>
                <p><strong>Available Prize:</strong> ${gamePrize} PeerLay tokens</p>
                <p><strong>Your Prize:</strong> ${formattedPayout} PeerLay tokens</p>
            `;
        } else {
            console.warn("Result display element not found.");
        }
    } catch (error) {
        console.error("Error calculating score:", error);
        showCustomAlert("An error occurred while calculating your score. Please try again.", 3000);
    }
});
