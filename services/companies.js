const {logError} = require("../logger/logger");

const {Bitrix} = require("@2bad/bitrix");

class CompaniesService {
    bx;

    constructor(link) {
        this.bx = Bitrix(link);
    }

    async getAllCompanies() {
        return new Promise(async (resolve, reject) => {
            const pageSize = 50; // Number of contacts to fetch per request
            let allCompanies = []; // Array to store all contacts

            let start = 0;
            let total = 0;

            try {
                do {
                    const data = await this.bx.call("crm.company.list", {
                        select: ["ID", "TITLE", "ASSIGNED_BY_ID"],
                        start: start,
                        count: pageSize
                    });

                    if (data && data.result) {
                        allCompanies = [...allCompanies, ...data.result];
                        total = data.total;
                        start += pageSize;
                    } else {
                        break; // Exit the loop if no more data or unexpected response structure
                    }

                } while (start < total);
                resolve(allCompanies);
            } catch (error) {
                logError("CONTACTS SERVICE getAllCompanies", error);
                reject(error); // Reject the promise if an error occurs
            }
        });
    }

    async getCompaniesFromId(id) {
        return new Promise(async (resolve, reject) => {
            const pageSize = 50; // Number of contacts to fetch per request
            let allCompanies = []; // Array to store all contacts

            let start = 0;
            let total = 0;

            try {
                do {
                    const data = await this.bx.call("crm.company.list", {
                        select: ["ID", "TITLE", "ASSIGNED_BY_ID"],
                        filter: {">ID": id}
                    });

                    if (data && data.result) {
                        allCompanies = [...allCompanies, ...data.result];
                        total = data.total;
                        start += pageSize;
                    } else {
                        break; // Exit the loop if no more data or unexpected response structure
                    }

                } while (start < total);
                resolve(allCompanies);
            } catch (error) {
                logError("COMPANIES SERVICE getAllCompanies", error);
                reject(error); // Reject the promise if an error occurs
            }
        });
    }
}

module.exports = {CompaniesService}