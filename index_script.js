// Global variables for reuse across functions
let gameID, gameStruct, gamePrize, currentTimestamp;
let selectedOptions = []; // Define selected options variable to use when casting predictions
let optionPercentages = Array(6).fill(null).map(() => Array(4).fill(null));
let eventsData = [];
const initialTimestamp = 1745089200;
let isOperationInProgress = false; // Prevent overlapping operations
let lastGamePlayed, predictionsCast;
let whitelistGame;
let userWhitelisted;

// Setup function to initialize shared values
async function initializeGameData() {
    try {
        showLoading();
        const gameDa = await contract.getGameData();
        gameID = Number(gameDa[0]);
        document.getElementById('gameIDValue').textContent = gameID;
        gamePrize = Number(gameDa[6]);
        currentTimestamp = Number(gameDa[7]);
        whitelistGame = Boolean(gameDa[8]);

        if (whitelistGame === true){
            const whitelistOnlyGame = document.getElementById('whitelistStatus');
            whitelistOnlyGame.style.display= "block";

        }
        
        // Update the displayed game prize
        document.getElementById('gamePrizeValue').textContent = `${gamePrize}`;

        let gameData = await contract.getGameEvents(gameID);
        gameStruct = gameData[2].map(Number);
        gameIndexes = gameData[0].map(Number);

        let targetTimeStamp = initialTimestamp + ((gameID * 7) + 7) * (24 * 60 * 60);
        const remainingTime = targetTimeStamp - currentTimestamp;
        let displayElement = document.getElementById("timeDisplay");

        if (remainingTime > 0) {
            // Format remaining time
            const days = Math.floor(remainingTime / (3600 * 24));
            const hours = Math.floor((remainingTime % (3600 * 24)) / 3600);
            const minutes = Math.floor((remainingTime % 3600) / 60);
            const seconds = remainingTime % 60;

            displayElement.textContent = `Next Game in: ${days}d ${hours}h ${minutes}m ${seconds}s`;
        } else {
            // Replace message with a button to start the new game
            displayElement.innerHTML = `
            <button id="startNewGameButton" class="action-btn align-right">
                Start New Game
            </button>
        `;        

            // Add an event listener to the button
            const startNewGameButton = document.getElementById("startNewGameButton");
            startNewGameButton.addEventListener("click", async () => {
                try {
                    showLoading();

                    // Estimate gas for the transaction
                    const gasEstimate = await contract.estimateGas.advancePhase();

                    // Fetch the current gas price
                    const provider = new ethers.providers.Web3Provider(window.ethereum);
                    const currentGasPrice = await provider.getGasPrice();

                    // Add a buffer to gas limit and gas price (20% buffer)
                    const bufferedGasLimit = gasEstimate.mul(ethers.BigNumber.from(12)).div(ethers.BigNumber.from(10));
                    const bufferedGasPrice = currentGasPrice.mul(ethers.BigNumber.from(12)).div(ethers.BigNumber.from(10));

                    // Send the transaction with buffered gas settings
                    const tx = await contract.advancePhase({
                        gasLimit: bufferedGasLimit,
                        gasPrice: bufferedGasPrice,
                    });

                    await tx.wait(); // Wait for the transaction to be mined
                    console.log("New game started successfully");

                    showCustomAlert("New game started successfully!", 3000);
                } catch (error) {
                    console.error("Error starting the new game:", error);
                    showCustomAlert(
                        "Failed to start the new game. Refresh your page or connect your account and try again.",
                        5000
                    );
                } finally {
                    hideLoading();
                }
            });
        }

        optionPercentages = await contract.getOptionPercentages(gameID);

        // Ensure each percentage is a number and divided by 10
        optionPercentages = optionPercentages.map(row => row.map(value => Number(value) / 10));

        // Initialize selectedOptions as an array of empty arrays (indicating no selection initially)
        selectedOptions = Array.from({ length: gameStruct.length }, () => []);

        return selectedOptions;
    } catch (error) {
        console.error('Error initializing game data:', error);
    }
}

// Loading the main table for game events
async function loadGameEvents() {
    try {
        // Fetch all event details at once
        const eventDetailsArray = await contract.getEvents(gameIndexes);

        // Transform the data into a suitable format for display
        eventsData = eventDetailsArray.map((eventDetails, index) => ({
            rank: gameIndexes[index],
            description: eventDetails.description, // Assuming `description` is a string
            options: eventDetails.options, // Assuming `options` is an array
        }));

        displayGameEvents(eventsData, optionPercentages);
        hideLoading();
    } catch (error) {
        console.error('Error loading game events:', error);
    }
}

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
        const sanitizedDescription = DOMPurify.sanitize(event.description);

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
        const descriptionText = document.createTextNode(sanitizedDescription);
        descriptionDiv.appendChild(descriptionText);

        eventContentDiv.appendChild(descriptionDiv);

        // Options section (without "Skip")
        const optionsDiv = document.createElement('div');
        optionsDiv.classList.add('event-options');

        event.options.forEach((option, optionIndex) => {
            const optionDiv = document.createElement('div');
            optionDiv.classList.add('optionPlusPercentage');
            const optionText = document.createElement('div');
            const sanitizedOption = DOMPurify.sanitize(option);
            const percentageDiv = document.createElement('div');
            percentageDiv.classList.add('option-percentage');
            const percentage = ` ${optionPercentages[eventIndex]?.[optionIndex] || 0}%`;
            percentageDiv.textContent = `${percentage}`;
            optionText.textContent = `${sanitizedOption}`;
            optionText.classList.add('outcome-option', 'selectable');

            optionText.dataset.eventId = eventIndex;
            optionText.dataset.optionIndex = optionIndex + 1;
            optionText.dataset.totalOptions = event.options.length;

            // Apply collapsibility to options if the text length exceeds 40 characters
            if (option.length > 40) {
                handleCollapsibleText(optionText, 40);
            }

            optionDiv.appendChild(percentageDiv);
            optionDiv.appendChild(optionText);

            optionText.addEventListener('click', () => handleOptionClick(optionText));

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

async function castPrediction() {
    if (isOperationInProgress) return; // Block if operation is in progress

    // Check if the wallet is connected
    if (!userAccount || typeof userAccount === 'undefined') {
        showCustomAlert('Please connect your wallet to cast a prediction.', 3000);
        return;
    } else if (userWhitelisted == false && whitelistGame == true){
        showCustomAlert('You need to be whitelisted to play this game.', 3000);
        return;
    }

    isOperationInProgress = true;

    try {
        showLoading1();

        for (let i = 0; i < selectedOptions.length; i++) {
            const selectedOptionsForEvent = selectedOptions[i];
            const totalOptions = gameStruct[i];

            if (selectedOptionsForEvent.length === 0) {
                showCustomAlert(`Please select at least one option for event ${i + 1}.`, 3000);
                return;
            }

            if (selectedOptionsForEvent.length > totalOptions - 1) {
                showCustomAlert(`For event ${i + 1}, you can select up to ${totalOptions - 1} options.`, 3000);
                return;
            }
        }

        if (predictionsCast === 3) {
            showCustomAlert(`You have already cast 3 predictions for this game. Cancel one in your Account page to cast a new one`, 6000);
            return;
        }

        const choiceID = getChoiceID(selectedOptions, gameStruct);

        // Estimate gas for the transaction
        const gasEstimate = await contract.estimateGas.castPrediction(choiceID, gameID);

        // Fetch the current gas price
        const provider = new ethers.providers.Web3Provider(window.ethereum);
        const currentGasPrice = await provider.getGasPrice();

        // Add a buffer to gas limit and gas price (20% buffer)
        const bufferedGasLimit = gasEstimate.mul(ethers.BigNumber.from(12)).div(ethers.BigNumber.from(10));
        const bufferedGasPrice = currentGasPrice.mul(ethers.BigNumber.from(12)).div(ethers.BigNumber.from(10));

        // Send the transaction with buffered gas settings
        const tx = await contract.castPrediction(choiceID, gameID, {
            gasLimit: bufferedGasLimit,
            gasPrice: bufferedGasPrice,
        });

        await tx.wait(); // Wait for the transaction to be mined
        console.log("Prediction cast successfully");
        predictionsCast += 1;

        showCustomAlert("Prediction cast successfully! Find it in your Account section.", 3000);

        // Reset selection
        selectedOptions = Array.from({ length: selectedOptions.length }, () => []);
        const optionCells = document.querySelectorAll('.selected');
        optionCells.forEach(option => option.classList.remove('selected'));
    } catch (error) {
        console.error('Error casting prediction:', error);
        showCustomAlert('Failed to cast the prediction.', 3000);
    } finally {
        isOperationInProgress = false; // Release lock
        hideLoading();
    }
}

// Global keydown listener to send a prediction when pressing Enter
document.addEventListener('keydown', (event) => {
    if (event.key === 'Enter') {
        castPrediction();
    }
});

document.addEventListener('contractsInitialized', async function () {
    await initializeGameData();
    await loadGameEvents();

    document.getElementById('a').style.display = 'block';
    document.getElementById('b').style.display = 'block';
    document.getElementById('placePrediction_btn').style.display = 'block';

    document.getElementById('placePrediction_btn').addEventListener('click', castPrediction);
});

function getChoiceID(selectedOptions, gameStruct) {
    let choiceId = 0;
    let base = 1;

    for (let i = 0; i < gameStruct.length; i++) {
        let combinationId = 0;

        // Handle selection, including 0 as a valid option
        if (selectedOptions[i].length === 0) {
            combinationId = 0; // Represents "no selection" or "skip"
        } else {
            selectedOptions[i].forEach(option => {
                if (option === 0) {
                    combinationId = 0; // Explicitly handle "0" as a valid option
                } else {
                    combinationId |= (1 << (option - 1)); // Set the appropriate bit for other options
                }
            });
        }

        // Add the current combination to the choiceId
        choiceId += combinationId * base;

        // Update the base multiplier for the next event
        base *= (1 << gameStruct[i]) - 1; // Equivalent to 2^gameStruct[i] - 1
    }

    return choiceId;
}

// Listen for wallet connection and reinitialize the account page
document.addEventListener('walletConnected', async function () {
    getUserNumberOfBets()
});

async function getUserNumberOfBets() {
    try {
        // Fetch game and user data from the contract
        const userData = await contract.getUserNumberOfBets();
        lastGamePlayed = Number(userData[0]);
        predictionsCast = Number(userData[1]);
        userWhitelisted = Boolean(userData[2]);

        if (lastGamePlayed !== gameID){
            predictionsCast = 0;
        }
    } catch (error) {
        console.error('Error initializing account:', error);
    }
}