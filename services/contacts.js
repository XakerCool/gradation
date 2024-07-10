const {logError} = require("../logger/logger");

const {Bitrix} = require("@2bad/bitrix");

class ContactsService {
    bx;

    constructor(link) {
        this.bx = Bitrix(link);
    }

    async getAllClients() {
        return new Promise(async (resolve, reject) => {
            const pageSize = 50; // Number of contacts to fetch per request
            let allClients = []; // Array to store all contacts

            let start = 0;
            let total = 0;

            try {
                do {
                    const data = await this.bx.call("crm.contact.list", {
                        select: ["ID", "NAME", "LAST_NAME", "SECOND_NAME", "ASSIGNED_BY_ID"],
                        start: start,
                        count: pageSize
                    });

                    if (data && data.result) {
                        allClients = [...allClients, ...data.result];
                        total = data.total;
                        start += pageSize;
                    } else {
                        break; // Exit the loop if no more data or unexpected response structure
                    }

                } while (start < total);

                resolve(allClients);
            } catch (error) {
                logError("CONTACTS SERVICE getAllClients", error);
                reject(error); // Reject the promise if an error occurs
            }
        });
    }

    async getClientsFromId(id) {
        return new Promise(async (resolve, reject) => {
            const pageSize = 50; // Number of contacts to fetch per request
            let allClients = []; // Array to store all contacts

            let start = 0;
            let total = 0;

            try {
                do {
                    const data = await this.bx.call("crm.contact.list", {
                        select: ["ID", "NAME", "LAST_NAME", "SECOND_NAME", "ASSIGNED_BY_ID"],
                        filter: { ">ID": id }
                    });

                    if (data && data.result) {
                        allClients = [...allClients, ...data.result];
                        total = data.total;
                        start += pageSize;
                    } else {
                        break; // Exit the loop if no more data or unexpected response structure
                    }

                } while (start < total);

                resolve(allClients);
            } catch (error) {
                logError("CONTACTS SERVICE getAllClients", error);
                reject(error); // Reject the promise if an error occurs
            }
        });
    }

}

module.exports = { ContactsService }