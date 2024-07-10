const {logError} = require("../logger/logger");

const crypto = require("crypto");

let connection;

async function getFromDb(bxId, table) {
    try {
        let query = `SELECT * FROM `;
        switch (table.toLowerCase()) {
            case "companies":
                query += `companies`;
                break;
            case "contacts":
                query += `clients`;
                break;
            case "deals":
                query += `deals`;
                break;
        }
        query += ` WHERE b_id = ?`;
        const params = [bxId];
        return await executeQuery(query, params);
    } catch (error) {
        logError("getFromDb", error);
        return null;
    }
}

async function addContactsToDb(contacts, bxId) {
    try {
        const insertPromises = contacts.map(async (contact) => {
            // Check if the contact already exists in the database
            const checkQuery = 'SELECT COUNT(*) AS count FROM clients WHERE id_in_bx = ? AND b_id = ?';
            const checkParams = [contact.ID, bxId];
            const [rows] = await executeQuery(checkQuery, checkParams);

            if (rows.count === 0) {
                // Contact does not exist, insert it
                const insertQuery = 'INSERT INTO clients (first_name, last_name, second_name, id_in_bx, assigned_by_id, b_id) VALUES (?, ?, ?, ?, ?, ?)';
                const insertParams = [contact.NAME, contact.LAST_NAME, contact.SECOND_NAME, contact.ID, contact.ASSIGNED_BY_ID, bxId];
                return executeQuery(insertQuery, insertParams);
            } else {
                // Contact already exists, handle as needed (maybe update or skip)
                return null; // Return null or handle differently if needed
            }
        });

        // Execute all insert queries asynchronously
        const results = await Promise.all(insertPromises);
        return results.filter(result => result !== null); // Filter out null results (skipped inserts)
    } catch (error) {
        logError("addContactsToDb", error);
        return null;
    }
}

async function addCompaniesToDb(companies, bxId) {
    try {
        const insertPromises = companies.map(async (company) => {
            // Check if the company already exists in the database
            const checkQuery = 'SELECT COUNT(*) AS count FROM companies WHERE id_in_bx = ? AND b_id = ?';
            const checkParams = [company.ID, bxId];
            const [rows] = await executeQuery(checkQuery, checkParams);

            if (rows.count === 0) {
                // Company does not exist, insert it
                const insertQuery = 'INSERT INTO companies (title, id_in_bx, assigned_by_id, b_id) VALUES (?, ?, ?, ?)';
                const insertParams = [company.TITLE, company.ID, company.ASSIGNED_BY_ID, bxId];
                return executeQuery(insertQuery, insertParams);
            } else {
                // Company already exists, handle as needed (maybe update or skip)
                return null; // Return null or handle differently if needed
            }
        });

        // Execute all insert queries asynchronously
        const results = await Promise.all(insertPromises);
        return results.filter(result => result !== null); // Filter out null results (skipped inserts)
    } catch (error) {
        logError("addCompaniesToDb", error);
        return null;
    }
}

async function getMaxId(bxId, table) {
    try {
        let query = `SELECT MAX(id_in_bx) as maxId FROM `;
        switch (table.toLowerCase()) {
            case "companies":
                query += `companies`;
                break;
            case "contacts":
                query += `clients`;
                break;
            case "deals":
                query += `deals`;
                break;
        }
        query += ` WHERE b_id = ?`;

        const params = [bxId];
        const rows = await executeQuery(query, params);

        if (rows.length > 0) {
            return rows[0].maxId;
        } else {
            return null; // No deals found for the given bxId
        }
    } catch (error) {
        logError("getMaxId", error);
        return null; // Propagate error further if necessary
    }
}

async function addDealsToDb(deals, bxId) {
    try {
        const insertPromises = deals.map(async (deal) => {
            const checkQuery = 'SELECT COUNT(*) AS count FROM deals WHERE id_in_bx = ? AND b_id = ?';
            const checkParams = [deal.ID, bxId];
            const [rows] = await executeQuery(checkQuery, checkParams);

            if (rows.count === 0) {
                const paymentDate = deal.PAYMENT_DATE.toString() === "" ? null : deal.PAYMENT_DATE.toString();
                const createDate = deal.CREATE_DATE.toString() === "" ? null : deal.CREATE_DATE.toString();
                const companyId = deal.COMPANY_ID?.toString() === "0" ? null : deal.COMPANY_ID;
                const contactId = deal.CONTACT_ID?.toString() === "0" ? null : deal.CONTACT_ID;
                // Company does not exist, insert it
                const insertQuery = 'INSERT INTO deals (title, company_id, contact_id, create_date, payment_date, opportunity, b_id, id_in_bx) VALUES (?, ?, ?, ?, ?, ?, ?, ?)';
                const insertParams = [deal.TITLE, companyId, contactId, createDate, paymentDate, deal.OPPORTUNITY, bxId, deal.ID];
                return executeQuery(insertQuery, insertParams);
            } else {
                // Company already exists, handle as needed (maybe update or skip)
                return null; // Return null or handle differently if needed
            }
        })
    } catch (error) {
        logError("addDealsToDb", error);
        return null;
    }
}

async function addBxLink(bxName, link, key) {
    try {
        const encryptedText = encrypt(link, key);

        // Insert encrypted link into MySQL database
        const query = 'INSERT INTO bitrixes (bx, link) VALUES (?, ?)';
        await executeQuery(query, [bxName, encryptedText]);

        return true;
    } catch (error) {
        logError("init_bx addBxLink", error);
    }
}

async function getBxCredentials(bxName, key) {
    try {
        // Fetch encrypted link from MySQL database
        const query = 'SELECT * FROM bitrixes WHERE bx = ?';
        const result = await executeQuery(query, [bxName]);

        if (result.length > 0) {
            const encryptedLink = result[0].link;
            const decryptedLink = decrypt(encryptedLink, key);

            return { bxId: result[0].id, link: decryptedLink, bx: result[0].bx }
        } else {
            throw new Error(`No Bitrix link found for ${bxName}`);
        }
    } catch (error) {
        logError("init_bx getBxCredentials", error);
    }
}

async function setSummary(bxId) {
    try {
        // Check if a summary row exists for the bxId
        const checkQuery = `
            SELECT COUNT(*) AS count
            FROM summary
            WHERE b_id = ?
        `;
        const checkParams = [bxId];
        const checkResult = await executeQuery(checkQuery, checkParams);

        if (checkResult[0].count > 0) {
            // Update existing row
            const updateQuery = `
                UPDATE summary
                SET clients_count = ?,
                    companies_count = ?,
                    deals_count = ?,
                    last_deal_date = ?
                WHERE b_id = ?
            `;
            const clientsCount = await getClientsCount(bxId);
            const companiesCount = await getCompaniesCount(bxId);
            const dealsCount = await getDealsCount(bxId);
            const lastDealDate = await getLastDealDateFromDeals(bxId);
            const updateParams = [clientsCount, companiesCount, dealsCount, lastDealDate, bxId];

            await executeQuery(updateQuery, updateParams);
        } else {
            // Insert new row
            const insertQuery = `
                INSERT INTO summary (b_id, clients_count, companies_count, deals_count, last_deal_date)
                VALUES (?, ?, ?, ?, ?)
            `;
            const clientsCount = await getClientsCount(bxId);
            const companiesCount = await getCompaniesCount(bxId);
            const dealsCount = await getDealsCount(bxId);
            const lastDealDate = await getLastDealDateFromDeals(bxId);
            const insertParams = [bxId, clientsCount, companiesCount, dealsCount, lastDealDate];

            await executeQuery(insertQuery, insertParams);
        }

        // Optionally, return a success message or indication
        return true;
    } catch (error) {
        logError("setSummary", error);
        return null; // Propagate error further if necessary
    }
}

async function getLastDealDateFromSummary(bxId) {
    try {
        const query = `SELECT last_deal_date AS lastDealDate FROM summary WHERE b_id = ?`;
        const params = [bxId];
        const rows = await executeQuery(query, params);

        if (rows.length > 0) {
            return rows[0].lastDealDate;
        } else {
            return null; // No deals found for the given bxId
        }
    } catch (error) {
        logError("getLastDealDateFromSummary", error);
        return null; // Propagate error further if necessary
    }
}

async function getLastDealDateFromDeals(bxId) {
    try {
        let query = `
            SELECT MAX(create_date) AS lastDealDate
            FROM deals
            WHERE b_id = ?
        `;
        const params = [bxId];
        const rows = await executeQuery(query, params);

        if (rows.length > 0) {
            return rows[0].lastDealDate;
        } else {
            return null; // No deals found for the given bxId
        }
    } catch (error) {
        logError("getLastDealDateFromDeals", error);
        return null; // Propagate error further if necessary
    }
}

async function getClientsCount(bxId) {
    try {
        let query = `
            SELECT COUNT(*) AS count
            FROM clients
            WHERE b_id = ?
        `;
        const params = [bxId];
        const rows = await executeQuery(query, params);

        if (rows.length > 0) {
            return rows[0].count;
        } else {
            return null; // No deals found for the given bxId
        }
    } catch (error) {
        logError("getClientsCount", error);
        return null; // Propagate error further if necessary
    }
}

async function getDealsCount(bxId) {
    try {
        let query = `
            SELECT COUNT(*) AS count
            FROM deals
            WHERE b_id = ?
        `;
        const params = [bxId];
        const rows = await executeQuery(query, params);

        if (rows.length > 0) {
            return rows[0].count;
        } else {
            return null; // No deals found for the given bxId
        }
    } catch (error) {
        logError("getDealsCount", error);
        return null; // Propagate error further if necessary
    }
}

async function getCompaniesCount(bxId) {
    try {
        let query = `
            SELECT COUNT(*) AS count
            FROM companies
            WHERE b_id = ?
        `;
        const params = [bxId];
        const rows = await executeQuery(query, params);

        if (rows.length > 0) {
            return rows[0].count;
        } else {
            return null; // No deals found for the given bxId
        }
    } catch (error) {
        logError("getCompaniesCount", error);
        return null; // Propagate error further if necessary
    }
}

async function checkIfExists(bxName) {
    try {
        const query = 'SELECT COUNT(*) AS count FROM bitrixes WHERE bx = ?';
        const result = await executeQuery(query, [bxName]);

        if (result.length > 0 && result[0].count > 0) {
            return true; // Record exists
        } else {
            return false; // Record does not exist
        }
    } catch (error) {
        logError("init_bx checkIfExists", error);
    }
}

function encrypt(text, key) {
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipheriv('aes-256-cbc', Buffer.from(key, 'hex'), iv);
    let encrypted = cipher.update(text, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    return iv.toString('hex') + ':' + encrypted;
}

function decrypt(encryptedText, key) {
    const textParts = encryptedText.split(':');
    const iv = Buffer.from(textParts.shift(), 'hex');
    const encrypted = Buffer.from(textParts.join(':'), 'hex');
    const decipher = crypto.createDecipheriv('aes-256-cbc', Buffer.from(key, 'hex'), iv);
    let decrypted = decipher.update(encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    return decrypted;
}

async function executeQuery(query, params) {
    return new Promise((resolve, reject) => {
        connection.query(query, params, (err, results) => {
            if (err) {
                reject(err);
            } else {
                resolve(results);
            }
        });
    });
}

module.exports = { addBxLink, getBxCredentials, checkIfExists, setConnection, addContactsToDb, addCompaniesToDb, addDealsToDb, setSummary, getLastDealDateFromSummary, getMaxId, getFromDb };

function setConnection(conn) {
    connection = conn;
}