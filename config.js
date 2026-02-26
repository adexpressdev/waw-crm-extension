const CONFIG = {
    // OAuth2 Client ID for Google Sheets API authentication
    CLIENT_ID: '851591119047-cb5o2v87ccqqepnmffbrobrb8ihmn0g6.apps.googleusercontent.com',

    // Google Spreadsheet ID
    SPREADSHEET_ID: '1uz2hWwPmOrDnGYt5UfzCm3_s4lCXsf_sfQDDQCX45Xw',

    // Sheet name within the spreadsheet
    SHEET_NAME: '🔵Team Blue🔵',

    // Derived configuration
    get PHONE_COLUMN_RANGE() {
        return `'${this.SHEET_NAME}'!M:M`;
    },

    AWAJ_DIGITAL_API_KEY: "oat_MTcx.LV90UzVvZ3VsM3pQR1NCUVp0Mk5LSm15SGdlRXFNVDVaQ3hiVWxIVTEyNDM0ODE2MjI",
    AWAJ_DIGITAL_SENDER: '09606990198',
    AWAJ_DIGITAL_VOICE_FOR_WAITING_FOR_APPROVAL: 'welcome',
    AWAJ_DIGITAL_VOICE_FOR_CODE_PENDING: 'welcome',
};

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = CONFIG;
}
