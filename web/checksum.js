const { getAddress } = require('viem');

const addresses = {
    TIP20_FACTORY_ADDRESS: "0x20FC000000000000000000000000000000000000",
    TEMPO_EXCHANGE_ADDRESS: "0xdec0000000000000000000000000000000000000",
    pathUSD: "0x20c0000000000000000000000000000000000000",
    AlphaUSD: "0x20c0000000000000000000000000000000000001",
    BetaUSD: "0x20c0000000000000000000000000000000000002",
    ThetaUSD: "0x20c0000000000000000000000000000000000003",
    PAYMENT_SCHEDULER_ADDRESS: "0x325EDdf3daB4cD51b2690253a11D3397850a7Bd2"
};

for (const [key, addr] of Object.entries(addresses)) {
    try {
        console.log(`${key}: ${getAddress(addr)}`);
    } catch (e) {
        console.error(`Error processing ${key}: ${e.message}`);
    }
}
