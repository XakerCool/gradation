const {logError} = require("../logger/logger");

const {Bitrix} = require("@2bad/bitrix");

class CompaniesService {
    bx;

    constructor(link) {
        this.bx = Bitrix(link);
    }

    async getAllCompanies() {
        return new Promise(async (resolve, reject) => {
            let allCompanies = []; // Array to store all contacts

            try {
                const data = await this.bx.companies.list( {
                    select: ["*"],
                });

                if (data && data.result) {
                    allCompanies = [...data.result];
                }
                resolve(allCompanies);
            } catch (error) {
                logError("COMPANIES SERVICE getAllCompanies", error);
                reject(error); // Reject the promise if an error occurs
            }
        });
    }

    async getCompaniesFromId(id) {
        return new Promise(async (resolve, reject) => {
            let allCompanies = []; // Array to store all contacts

            try {
                const data = await this.bx.companies.list({
                    select: ["*"],
                    filter: {">ID": id}
                });

                if (data && data.result) {
                    allCompanies = [...data.result];
                }
                resolve(allCompanies);
            } catch (error) {
                logError("COMPANIES SERVICE getAllCompanies", error);
                reject(error); // Reject the promise if an error occurs
            }
        });
    }
}

module.exports = {CompaniesService}