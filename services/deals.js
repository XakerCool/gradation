const {logError} = require("../logger/logger");

const {Bitrix} = require("@2bad/bitrix");

class DealsService {
    bx;

    constructor(link) {
        this.bx = Bitrix(link);
    }

    async fetchDealsByDate(date = null) {
        try {
            const paymentDateUserField = await this.getDealsUserFieldsService();
            let deals = [];
            if (date) {
                deals = await this.getDealsFromDateService(date);
            } else {
                deals = await this.getAllDealsService();
            }

            const dealsWithDetails = await this.fetchDealsDetailsService(deals);

            return dealsWithDetails.map(deal => {
                return {
                    ID: deal.ID,
                    TITLE: deal.TITLE,
                    COMPANY_ID: deal.COMPANY_ID,
                    CONTACT_ID: deal.CONTACT_ID,
                    CREATE_DATE: deal.DATE_CREATE,
                    PAYMENT_DATE: deal[paymentDateUserField.FIELD_NAME],
                    OPPORTUNITY: deal.OPPORTUNITY
                }
            });
        } catch (error) {
            logError("DEALS SERVICE fetchDeals", error);
            return null;
        }
    }

    async fetchDealsById(id = null) {
        try {
            const paymentDateUserField = await this.getDealsUserFieldsService();
            let deals = [];
            if (id) {
                deals = await this.getDealsFromId(id);
            } else {
                deals = await this.getAllDealsService();
            }

            const dealsWithDetails = await this.fetchDealsDetailsService(deals);

            return dealsWithDetails.map(deal => {
                return {
                    ID: deal.ID,
                    TITLE: deal.TITLE,
                    COMPANY_ID: deal.COMPANY_ID,
                    CONTACT_ID: deal.CONTACT_ID,
                    CREATE_DATE: deal.DATE_CREATE,
                    PAYMENT_DATE: deal[paymentDateUserField.FIELD_NAME],
                    OPPORTUNITY: deal.OPPORTUNITY
                }
            });
        } catch (error) {
            logError("DEALS SERVICE fetchDeals", error);
            return null;
        }
    }

    getDealsFromDateService(date) {
        return new Promise(async (resolve, reject) => {
            const pageSize = 50; // Number of contacts to fetch per request
            let allDeals = []; // Array to store all contacts

            let start = 0;
            let total = 0;

            try {
                do {
                    const data = await this.bx.deals.list({
                        filter: {
                            ">DATE_CREATE": date
                        }
                    })
                    if (data && data.result) {
                        allDeals = [...allDeals, ...data.result];
                        total = data.total;
                        start += pageSize;
                    } else {
                        break; // Exit the loop if no more data or unexpected response structure
                    }
                } while(start < total);

                resolve(allDeals);
            } catch (error) {
                logError("DEALS SERVICE getAllDealsHandler", error);
                reject(null);
            }
        })
    }

    getAllDealsService() {
        return new Promise(async (resolve, reject) => {
            const pageSize = 50; // Number of contacts to fetch per request
            let allDeals = []; // Array to store all contacts

            let start = 0;
            let total = 0;

            try {
                do {
                    const data = await this.bx.deals.list({
                        select: ["*"]
                    })
                    if (data && data.result) {
                        allDeals = [...allDeals, ...data.result];
                        total = data.total;
                        start += pageSize;
                    } else {
                        break; // Exit the loop if no more data or unexpected response structure
                    }

                } while(start < total);

                resolve(allDeals);
            } catch (error) {
                console.log(allDeals);
                logError("DEALS SERVICE getAllDealsService", error);
                reject(null);
            }
        })
    }

    getDealsFromId(id) {
        return new Promise(async (resolve, reject) => {
            const pageSize = 50; // Number of contacts to fetch per request
            let allDeals = []; // Array to store all contacts

            let start = 0;
            let total = 0;

            try {
                do {
                    const data = await this.bx.deals.list({
                        select: ["*"],
                        filter: { ">ID": id }
                    })
                    if (data && data.result) {
                        allDeals = [...allDeals, ...data.result];
                        total = data.total;
                        start += pageSize;
                    } else {
                        break; // Exit the loop if no more data or unexpected response structure
                    }

                } while(start < total);

                resolve(allDeals);
            } catch (error) {
                console.log(allDeals);
                logError("DEALS SERVICE getDealsFromId", error);
                reject(null);
            }
        })
    }

    async fetchDealsDetailsService(data) {
        try {
            const fetchPromises = data.map(deal => {
                return this.bx.deals.get(deal.ID)
                    .then(data => {
                        return data.result;
                    })
                    .catch(err => {
                        return null;
                    });
            });
            return await Promise.all(fetchPromises);
        } catch (error) {
            logError("DEALS SERVICE fetchDealsDetails", error);
            return [];
        }
    }

    async getDealsUserFieldsService() {
        try {
            const response = await this.bx.call("crm.deal.userfield.list", {
                order: { "SORT": "ASC" },
                filter: { LANG: 'ru' }
            });

            if (response && response.result) {
                const dateOfPaymentField = response.result.find(field => this.findField(field["EDIT_FORM_LABEL"]) || this.findField(field["LIST_COLUMN_LABEL"]) || this.findField(field["LIST_FILTER_LABEL"]));

                if (dateOfPaymentField) {
                    return dateOfPaymentField; // Return the specific user field
                } else {
                    return null; // Return null if the field "Дата оплаты" is not found
                }
            } else {
                logError("DEALS HANDLER getDealsUserFields", "No user fields found or invalid response structure.");
                return null;
            }
        } catch (error) {
            logError("DEALS SERVICE getDealsUserFields", error);
            return null;
        }
    }

    findField(search) {
        switch (search.toLowerCase()) {
            case "дата оплаты":
                return true;
            case "планируемая дата оплаты":
                return true;
            case "предполагаемая дата оплаты":
                return true;
            default:
                return false;
        }
    }
}

module.exports = { DealsService }