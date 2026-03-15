export const getCurrencySymbol = (code) => {
    switch (code) {
        case 'EUR': return '€';
        case 'GBP': return '£';
        case 'INR': return '₹';
        case 'JPY': return '¥';
        case 'CAD': return 'CA$';
        case 'AUD': return 'A$';
        case 'CHF': return 'CHF';
        case 'CNY': return '¥';
        case 'SEK': return 'kr';
        case 'NZD': return 'NZ$';
        case 'KRW': return '₩';
        case 'SGD': return 'S$';
        case 'NOK': return 'kr';
        case 'MXN': return 'Mex$';
        case 'HKD': return 'HK$';
        case 'ZAR': return 'R';
        case 'BRL': return 'R$';
        case 'RUB': return '₽';
        case 'USD': default: return '$';
    }
};

export const formatCurrency = (amount, code = 'USD') => {
    const symbol = getCurrencySymbol(code);
    const num = Number(amount);
    if (isNaN(num)) return `${symbol}0.00`;
    
    // Currencies that typically don't use decimal places
    if (['JPY', 'KRW'].includes(code)) return `${symbol}${num.toFixed(0)}`;
    
    return `${symbol}${num.toFixed(2)}`;
};
