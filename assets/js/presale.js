// presale.js - implements the working presale dapp functionality for the given contract address

const contractAddress = "0x1Fe716F572B6DD5a92379E76949c0F951821BB18";
const contractABI = [
  {"inputs":[{"internalType":"uint256","name":"_rate","type":"uint256"},{"internalType":"contract IST20","name":"_token","type":"address"},{"internalType":"uint256","name":"_max","type":"uint256"}],"stateMutability":"nonpayable","type":"constructor"},
  {"anonymous":false,"inputs":[{"indexed":true,"internalType":"address","name":"previousOwner","type":"address"},{"indexed":true,"internalType":"address","name":"newOwner","type":"address"}],"name":"OwnershipTransferred","type":"event"},
  {"anonymous":false,"inputs":[{"indexed":true,"internalType":"address","name":"purchaser","type":"address"},{"indexed":true,"internalType":"address","name":"beneficiary","type":"address"},{"indexed":false,"internalType":"uint256","name":"value","type":"uint256"},{"indexed":false,"internalType":"uint256","name":"amount","type":"uint256"}],"name":"TokenPurchase","type":"event"},
  {"stateMutability":"payable","type":"fallback"},
  {"inputs":[{"internalType":"uint256","name":"_weiAmount","type":"uint256"}],"name":"_getTokenAmount","outputs":[{"internalType":"uint256","name":"","type":"uint256"}],"stateMutability":"view","type":"function"},
  {"inputs":[{"internalType":"address","name":"_beneficiary","type":"address"},{"internalType":"uint256","name":"_weiAmount","type":"uint256"}],"name":"_preValidatePurchase","outputs":[{"internalType":"uint256","name":"","type":"uint256"}],"stateMutability":"view","type":"function"},
  {"inputs":[{"internalType":"address","name":"_beneficiary","type":"address"}],"name":"buyTokens","outputs":[],"stateMutability":"payable","type":"function"},
  {"inputs":[{"internalType":"address","name":"_beneficiary","type":"address"}],"name":"maxBnb","outputs":[{"internalType":"uint256","name":"","type":"uint256"}],"stateMutability":"view","type":"function"},
  {"inputs":[],"name":"owner","outputs":[{"internalType":"address","name":"","type":"address"}],"stateMutability":"view","type":"function"},
  {"inputs":[{"internalType":"address","name":"","type":"address"}],"name":"purchasedBnb","outputs":[{"internalType":"uint256","name":"","type":"uint256"}],"stateMutability":"view","type":"function"},
  {"inputs":[],"name":"rate","outputs":[{"internalType":"uint256","name":"","type":"uint256"}],"stateMutability":"view","type":"function"},
  {"inputs":[{"internalType":"uint256","name":"_rate","type":"uint256"}],"name":"setPresaleRate","outputs":[],"stateMutability":"nonpayable","type":"function"},
  {"inputs":[],"name":"token","outputs":[{"internalType":"contract IST20","name":"","type":"address"}],"stateMutability":"view","type":"function"},
  {"inputs":[{"internalType":"address","name":"newOwner","type":"address"}],"name":"transferContractOwnership","outputs":[],"stateMutability":"nonpayable","type":"function"},
  {"inputs":[{"internalType":"address","name":"newOwner","type":"address"}],"name":"transferOwnership","outputs":[],"stateMutability":"nonpayable","type":"function"},
  {"inputs":[],"name":"weiMaxPurchaseBnb","outputs":[{"internalType":"uint256","name":"","type":"uint256"}],"stateMutability":"view","type":"function"},
  {"inputs":[],"name":"weiRaised","outputs":[{"internalType":"uint256","name":"","type":"uint256"}],"stateMutability":"view","type":"function"},
  {"inputs":[{"internalType":"address","name":"tokenAddress","type":"address"},{"internalType":"uint256","name":"tokens","type":"uint256"}],"name":"withdrawTokens","outputs":[],"stateMutability":"nonpayable","type":"function"},
  {"stateMutability":"payable","type":"receive"}
];

let provider;
let signer;
let contract;
let web3Modal;
let selectedAccount;
let bnbBalance;
let minBuy = 0.01; // Defined globally
let maxBuy = 1;   // Defined globally

const Web3Modal = window.Web3Modal && window.Web3Modal.default ? window.Web3Modal.default : window.Web3Modal;
const WalletConnectProvider = window.WalletConnectProvider && window.WalletConnectProvider.default ? window.WalletConnectProvider.default : window.WalletConnectProvider;

const providerOptions = {
  injected: {
    package: null
  },
  walletconnect: {
    package: WalletConnectProvider,
    options: {
      rpc: {
        56: "https://bsc-dataseed.binance.org/"
      },
      chainId: 56
    }
  },
  binancechainwallet: {
    package: true
  }
};

async function init() {
  // Correctly initialize Web3Modal
  web3Modal = new Web3Modal({
    cacheProvider: true,
    providerOptions: providerOptions,
    theme: {
      background: "#55aaffab",
      main: "#000000",
      secondary: "#ffffff",
      hover: "#4e49003f"
    }
  });

  document.getElementById("connectWalletBtn").addEventListener("click", connectWallet);
  document.getElementById("buyTokensBtn").addEventListener("click", buyTokens);

  await updateContractData();
}

async function connectWallet() {
  try {
    const instance = await web3Modal.connect();
    provider = new window.ethers.providers.Web3Provider(instance);
    signer = provider.getSigner();
    selectedAccount = await signer.getAddress();

    const network = await provider.getNetwork();
    if (network.chainId !== 56) {
      alert("Please switch to Binance Smart Chain (BSC) network.");
      return;
    }

    contract = new window.ethers.Contract(contractAddress, contractABI, signer);

    await fetchBnbBalance(selectedAccount, provider);

    // Fix: Check if element exists before setting innerText
    const walletAddressDisplay = document.getElementById("walletAddressDisplay");
    if (walletAddressDisplay) {
      walletAddressDisplay.innerText = selectedAccount;
    } else {
      alert("Failed to connect wallet: Wallet address display element not found.");
      return;
    }

    const connectWalletBtn = document.getElementById("connectWalletBtn");
    if (connectWalletBtn) {
      connectWalletBtn.innerText = "Wallet Connected";
    } else {
      alert("Failed to connect wallet: Connect Wallet button element not found.");
      return;
    }

    const buyTokensBtn = document.getElementById("buyTokensBtn");
    if (buyTokensBtn) {
      buyTokensBtn.disabled = false;
    }

    if (provider.on) {
      provider.on("accountsChanged", (accounts) => {
        if (accounts.length === 0) {
          disconnectWallet();
        } else {
          selectedAccount = accounts[0];
          const walletAddressDisplay = document.getElementById("walletAddressDisplay");
          if (walletAddressDisplay) {
            walletAddressDisplay.innerText = selectedAccount;
          }
          fetchBnbBalance(selectedAccount, provider);
        }
      });

      provider.on("chainChanged", () => {
        window.location.reload();
      });

      provider.on("disconnect", () => {
        disconnectWallet();
      });
    }

    await updateContractData();
  } catch (error) {
    console.error("Wallet connection failed:", error);
    alert("Failed to connect wallet: " + error.message);
  }
}

async function fetchBnbBalance(account, provider) {
  if (!account || !provider) return;
  try {
    const balance = await provider.getBalance(account);
    bnbBalance = window.ethers.utils.formatEther(balance);
  } catch (error) {
    console.error("Failed to fetch BNB balance:", error);
  }
}

async function disconnectWallet() {
  try {
    if (provider && provider.disconnect && typeof provider.disconnect === "function") {
      await provider.disconnect();
    }
    web3Modal.clearCachedProvider();
    selectedAccount = null;
    bnbBalance = null;
    document.getElementById("walletAddressDisplay").innerText = "";
    document.getElementById("connectWalletBtn").innerText = "Connect Wallet";
    const buyTokensBtn = document.getElementById("buyTokensBtn");
    if (buyTokensBtn) {
      buyTokensBtn.disabled = true;
    }
    window.location.reload();
  } catch (error) {
    console.error("Disconnect failed:", error);
  }
}

async function updateContractData() {
  if (!contract) {
    const readProvider = new window.ethers.providers.JsonRpcProvider("https://bsc-dataseed.binance.org/");
    contract = new window.ethers.Contract(contractAddress, contractABI, readProvider);
  }
  try {
    let rate = await contract.rate();
    // Adjust rate for decimals (assuming 18 decimals)
    rate = rate / 1e18;

    const weiRaised = await contract.weiRaised();
    const bnbRaised = window.ethers.utils.formatEther(weiRaised);

    let bnbPrice = 750;
    try {
      const response = await fetch('https://api.coingecko.com/api/v3/simple/price?ids=binancecoin&vs_currencies=usd');
      const data = await response.json();
      bnbPrice = data.binancecoin.usd;
    } catch (error) {
      console.warn("Failed to fetch BNB price, using fallback:", error);
    }
    const usdtRaised = (parseFloat(bnbRaised) * bnbPrice).toFixed(2);
    const totalGoal = 130760;
    const percentage = Math.min((parseFloat(usdtRaised) / totalGoal) * 100, 100);

    // Dynamic Min/Max buy values
    const minBuy = 0.01;
    const maxBuy = 1;
    const tokenPriceUSD = 0.015;

    // Fix: Check if elements exist before setting innerText or style
    const rateDisplay = document.getElementById("rateDisplay");
    if (rateDisplay) {
      rateDisplay.innerText = rate.toString();
    }

    const maxBuyDisplay = document.getElementById("maxBuyDisplay");
    if (maxBuyDisplay) {
      maxBuyDisplay.innerText = maxBuy.toString();
    }

    const minBuyDisplay = document.getElementById("minBuyDisplay");
    if (minBuyDisplay) {
      minBuyDisplay.innerText = minBuy.toString();
    }

    const tokenPriceUSDDisplay = document.getElementById("tokenPriceUSDDisplay");
    if (tokenPriceUSDDisplay) {
      tokenPriceUSDDisplay.innerText = tokenPriceUSD.toFixed(3);
    }

    const usdtRaisedDisplay = document.getElementById("usdtRaisedDisplay");
    if (usdtRaisedDisplay) {
      usdtRaisedDisplay.innerText = usdtRaised;
    }

    const progressPercent = document.getElementById("progressPercent");
    if (progressPercent) {
      progressPercent.innerText = percentage.toFixed(1) + '%';
    }

    const progressBar = document.getElementById("progressBar");
    if (progressBar) {
      progressBar.style.width = percentage.toFixed(1) + '%';
    }
  } catch (error) {
    console.error("Failed to fetch contract data:", error);
  }
}

async function buyTokens() {
  if (!contract || !signer) {
    alert("Please connect your wallet first.");
    return;
  }
  const payInInput = document.getElementById("payInInput");
  const payInValue = parseFloat(payInInput.value);

  // Added client-side validation
  if (isNaN(payInValue) || payInValue <= 0) {
    alert("Please enter a valid amount to pay.");
    return;
  }

  if (payInValue < minBuy || payInValue > maxBuy) {
    alert(`Purchase amount must be between ${minBuy} and ${maxBuy} BNB.`);
    return;
  }
  
  if (bnbBalance && payInValue > parseFloat(bnbBalance)) {
    alert("Insufficient BNB balance to complete this transaction.");
    return;
  }

  try {
    const tx = await contract.buyTokens(selectedAccount, { value: window.ethers.utils.parseEther(payInValue.toString()) });
    alert("Transaction sent. Waiting for confirmation...");
    await tx.wait();
    alert("Purchase successful!");
    await updateContractData();
  } catch (error) {
    console.error("Purchase failed:", error);
    alert("Purchase failed: " + (error.data?.message || error.message));
  }
}

window.addEventListener("load", () => {
  init();
  const presaleSection = document.getElementById("presale-section");
  if (presaleSection) {
    presaleSection.scrollIntoView({ behavior: "smooth" });
  }
});