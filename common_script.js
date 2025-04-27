// GameData, CastPrediction, getPlayerPrediction, getGameData
// // TOP-LEVEL VARIABLES
let contract; // Contract for the main contract
let userAccount;
let isContractsInitialized = false; // Flag to track initialization

// Replace these addresses with the actual deployed contract addresses
const contractAddress = '0x4e3977c1e5559c5c6387c971de4e14eB50CB526E';  // Contract address

// Target network details (Base Mainnet)
const TARGET_CHAIN_ID = '0x2105'; // Hexadecimal for 84531 (Base Mainnet)
const NETWORK_NAME = 'Base Mainnet';

// Fallback Base Mainnet Node URL (Public Endpoint)
const NODE_URL = 'https://mainnet.base.org'; // Use a public RPC provider for Base Mainnet

// COMMON FUNCTIONS FOR ALL PAGES
async function loadABI(file) {
    try {
        const response = await fetch(file); // Fetch ABI from the specified local file
        const abi = await response.json();
        return abi;
    } catch (error) {
        console.error(`Error loading ABI from ${file}:`, error);
    }
}

// Initialize Web3 and the contracts
async function initContracts(useFallback = false) {
    if (isContractsInitialized) {
        console.log('Contracts already initialized.');
        return; // Prevent multiple initializations
    }

    // Load the ABIs
    const abiContract = await loadABI('abi_contract.json');

    let provider, signer;
    if (useFallback || !window.ethereum) {
        console.log('Using fallback node...');
        provider = new ethers.providers.JsonRpcProvider(NODE_URL);
    } else {
        provider = new ethers.providers.Web3Provider(window.ethereum);
        const accounts = await provider.listAccounts(); // Fetch connected accounts

        if (accounts.length > 0) {
            signer = provider.getSigner(); // Use signer if accounts exist
        } else {
            console.warn('No wallet account connected. Using fallback provider for readonly operations.');
            useFallback = true;
            provider = new ethers.providers.JsonRpcProvider(NODE_URL);
        }
    }

    // Initialize the contracts
    contract = signer
        ? new ethers.Contract(contractAddress, abiContract, signer) // Full access with signer
        : new ethers.Contract(contractAddress, abiContract, provider); // Readonly access

    console.log('Main contract initialized:', contract);

    isContractsInitialized = true; // Mark as initialized
    document.dispatchEvent(new Event('contractsInitialized'));
}

// Function to check if the wallet is on the correct network
async function checkNetwork() {
    try {
        if (!window.ethereum) {
            showCustomAlert('No Ethereum-compatible wallet found.', 3000);
            return false;
        }

        const chainId = await window.ethereum.request({ method: 'eth_chainId' });
        if (chainId === TARGET_CHAIN_ID) {
            console.log(`Connected to the correct network: ${NETWORK_NAME}`);
            return true;
        } else {
            console.warn(`Incorrect network. Expected: ${NETWORK_NAME}, but got chain ID: ${chainId}`);
            return false;
        }
    } catch (error) {
        console.error('Error checking network:', error);
        return false;
    }
}

// Function to request a network switch
async function switchNetwork() {
    try {
        await window.ethereum.request({
            method: 'wallet_switchEthereumChain',
            params: [{ chainId: TARGET_CHAIN_ID }],
        });
        console.log(`Successfully switched to ${NETWORK_NAME}`);
        return true;
    } catch (error) {
        if (error.code === 4902) {
            showCustomAlert(`${NETWORK_NAME} is not available in your wallet. Please add it manually.`, 3000);
        } else {
            console.error('Error switching network:', error);
        }
        return false;
    }
}

// Ensure the wallet is on the correct network
async function ensureCorrectNetwork() {
    const isCorrectNetwork = await checkNetwork();
    if (!isCorrectNetwork) {
        console.log('Switching to the correct network...');
        const switched = await switchNetwork();
        if (!switched) {
            showCustomAlert(`Please manually switch to ${NETWORK_NAME} in your wallet.`, 3000);
        }
    }
}

// Connect the wallet and check the network
async function connectWallet() {
    const connectedAccount = sessionStorage.getItem('connectedAccount');

    if (connectedAccount) {
        const confirmDisconnect = confirm('You are already connected. Do you want to disconnect?');
        if (confirmDisconnect) {
            sessionStorage.removeItem('connectedAccount');
            userAccount = null;

            // Update the button text
            const walletButton = document.getElementById('connectWallet');
            walletButton.textContent = ''; // Clear previous content

            const walletIcon = document.createElement('img');
            walletIcon.src = 'favicons/wallet-icon.png';
            walletIcon.alt = 'Wallet Icon';
            walletIcon.classList.add('wallet-icon');

            const buttonText = document.createTextNode('Connect Wallet');
            walletButton.appendChild(walletIcon);
            walletButton.appendChild(buttonText);

            console.log('Disconnected from Web3 wallet.');
            return;
        }
    } else {
        if (window.ethereum) {
            try {
                const accounts = await window.ethereum.request({ method: 'eth_requestAccounts' });
                userAccount = accounts[0];
                console.log('Connected account:', userAccount);

                sessionStorage.setItem('connectedAccount', userAccount);

                // Update the button text
                const walletButton = document.getElementById('connectWallet');
                walletButton.textContent = ''; // Clear previous content

                const walletIcon = document.createElement('img');
                walletIcon.src = 'favicons/wallet-icon.png';
                walletIcon.alt = 'Wallet Icon';
                walletIcon.classList.add('wallet-icon');

                const shortenedAccount = `${userAccount.slice(0, 6)}...${userAccount.slice(-4)}`;
                const accountText = document.createTextNode(shortenedAccount);

                walletButton.appendChild(walletIcon);
                walletButton.appendChild(accountText);

                await ensureCorrectNetwork(); // Ensure correct network
                await initContracts(); // Initialize contracts after wallet connection
                document.dispatchEvent(new Event('walletConnected'));
            } catch (error) {
                if (error.code === 4001) { // User rejected the connection
                    console.warn('User denied wallet connection.');
                } else {
                    console.error('Error connecting to Web3 wallet:', error);
                }
                showCustomAlert('Failed to connect to Web3 wallet.', 3000);
            }
        } else {
            showCustomAlert('Web3 wallet is not installed. Please install Coinbase Wallet and try again.', 3000);
        }
    }
}

async function checkConnectedAccount() {
    const connectedAccount = sessionStorage.getItem('connectedAccount');

    if (connectedAccount) {
        userAccount = connectedAccount;
        const accounts = await window.ethereum.request({ method: 'eth_accounts' });
        const currentAccount = accounts[0];

        if (connectedAccount !== currentAccount) {
            console.log('Account changed, updating...');
            sessionStorage.setItem('connectedAccount', currentAccount);
            userAccount = currentAccount;
        } else {
            userAccount = connectedAccount;
        }

        // Ensure contracts are initialized
        if (!isContractsInitialized) {
            await initContracts();
        }

        console.log('Connected account found:', userAccount);

        // Shorten the connected account address
        const shortenedAccount = `${userAccount.slice(0, 6)}...${userAccount.slice(-4)}`;

        // Update the button UI with the wallet icon and shortened address
        const walletButton = document.getElementById('connectWallet');
        walletButton.textContent = ''; // Clear previous content

        const walletIcon = document.createElement('img');
        walletIcon.src = 'favicons/wallet-icon.png';
        walletIcon.alt = 'Wallet Icon';
        walletIcon.classList.add('wallet-icon');

        const accountText = document.createTextNode(shortenedAccount);
        walletButton.appendChild(walletIcon);
        walletButton.appendChild(accountText);

        // Dispatch the 'walletConnected' event since the account is found
        document.dispatchEvent(new Event('walletConnected'));
    } else {
        console.log('No connected account found.');
    }
}

document.addEventListener('DOMContentLoaded', async () => {
    if (window.ethereum) {
        console.log("Ethereum-compatible wallet detected.");

        // Add event listener for network changes
        window.ethereum.on('chainChanged', (chainId) => {
            console.log('Network changed to:', chainId);
            if (chainId !== TARGET_CHAIN_ID) {
                showCustomAlert(`You switched to an unsupported network. Please switch back to ${NETWORK_NAME}.`, 3000);
            } else {
                console.log(`You are now connected to ${NETWORK_NAME}.`);
            }
        });

        try {
            // Check if any wallet accounts are already connected
            const accounts = await window.ethereum.request({ method: 'eth_accounts' });

            if (accounts.length > 0) {
                console.log('Wallet connected:', accounts[0]);
                userAccount = accounts[0];
                await ensureCorrectNetwork(); // Ensure correct network
                await initContracts(); // Use wallet provider with signer
                await checkConnectedAccount(); // Restore session if available
            } else {
                console.log('No wallet account connected. Falling back to public node...');
                await initContracts(true); // Use the fallback node
            }
        } catch (error) {
            console.warn('Error checking wallet accounts. Falling back to node...', error);
            await initContracts(true); // Use the fallback node
        }
    } else {
        console.log("Ethereum-compatible wallet not detected. Using fallback node.");
        await initContracts(true); // Use the fallback node
    }
});

document.getElementById('connectWallet').addEventListener('click', async () => {
    await connectWallet();
});

function handleCollapsibleText(element, charLimit) {
    const content = element.textContent.trim();
    
    // Only apply collapsibility if content length exceeds the character limit
    if (content.length <= charLimit) return;

    // Create the visible and hidden text parts
    const visibleText = content.slice(0, charLimit);
    const extraText = content.slice(charLimit);

    const visibleSpan = document.createElement('span');
    visibleSpan.className = 'visible-text';
    visibleSpan.textContent = visibleText;

    const extraSpan = document.createElement('span');
    extraSpan.className = 'extra-text';
    extraSpan.textContent = extraText;
    extraSpan.style.display = 'none';  // Initially hidden

    const seeMoreLink = document.createElement('span');
    seeMoreLink.className = 'see-more-link';
    seeMoreLink.textContent = ' See more';
    seeMoreLink.style.color = 'blue';
    seeMoreLink.style.cursor = 'pointer';

    // Append structured content to the element
    element.innerHTML = '';
    element.classList.add('collapsible');  // Apply collapsible styling
    element.appendChild(visibleSpan);
    element.appendChild(extraSpan);
    element.appendChild(seeMoreLink);

    // Toggle expand/collapse on "See more" click
    seeMoreLink.addEventListener('click', function () {
        const isExpanded = element.classList.toggle('expand');
        extraSpan.style.display = isExpanded ? 'inline' : 'none';
        seeMoreLink.textContent = isExpanded ? ' See less' : ' See more';
    });
}

function showLoading() {
    const logoImage = document.querySelector('.nav-logo .logo-image');
    logoImage.classList.add('spinner');

    const loadingBanner = document.getElementById('loadingBanner');
    if (loadingBanner) {
        loadingBanner.style.display = 'flex'; // or 'block' depending on your layout
    }

    const eventContainer = document.getElementById('event-container');
    if (eventContainer) {
        eventContainer.style.display = 'none'; // or 'block' depending on your layout
    }
}

function showLoading1() {
    const logoImage = document.querySelector('.nav-logo .logo-image');
    logoImage.classList.add('spinner');
}

function hideLoading() {
    const logoImage = document.querySelector('.nav-logo .logo-image');
    logoImage.classList.remove('spinner');
    const loadingBanner = document.getElementById('loadingBanner');
    if (loadingBanner) {
        loadingBanner.style.display = 'none'; // or 'block' depending on your layout
    }

    const eventContainer = document.getElementById('event-container');
    if (eventContainer) {
        eventContainer.style.display = 'block';
    }
}

const menuOpenButton = document.querySelector("#menu-open-button");
menuOpenButton.addEventListener("click", () => {
    document.body.classList.toggle("show-mobile-menu")
});

const menuCloseButton = document.querySelector("#menu-close-button");
menuCloseButton.addEventListener("click", () => menuOpenButton.click())

// Function to show the custom alert with auto-close feature
function showCustomAlert(message) {
    const alertElement = document.querySelector('.custom-alert');
    const alertContent = document.querySelector('.custom-alert-content');

    // Set the alert message
    alertContent.textContent = message;

    // Dynamically calculate and set `top` for the alert (120px from the top)
    const scrollOffset = window.scrollY; // Get the current vertical scroll position
    alertElement.style.top = `${scrollOffset + 30}px`;
    alertElement.style.left = '50%'; // Center horizontally
    alertElement.style.transform = 'translateX(-50%)'; // Adjust for exact horizontal centering

    // Show the alert
    alertElement.style.display = 'block';

    // Automatically hide the alert after 3 seconds
    setTimeout(() => {
        alertElement.style.display = 'none';
    }, 3000);
}