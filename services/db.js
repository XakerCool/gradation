const {logError} = require("../logger/logger");

const crypto = require("crypto");

let connection;

async function getFromDb(table) {
    try {
        let query = `SELECT * FROM `;
        switch (table.toLowerCase()) {
            case "companies":
                query += `companies`;
                break;
            case "deals":
                query += `deals`;
                break;
        }
        const params = [];
        return await executeQuery(query, params);
    } catch (error) {
        logError("getFromDb", error);
        return null;
    }
}

async function addCompaniesToDb(companies) {
    try {
        const insertPromises = companies.map(async (company) => {
            // Check if the company already exists in the database
            const checkQuery = 'SELECT COUNT(*) AS count FROM companies WHERE id_in_bx = ?';
            const checkParams = [company.ID];
            const [rows] = await executeQuery(checkQuery, checkParams);

            if (rows.count === 0) {
                // Company does not exist, insert it
                const insertQuery = 'INSERT INTO companies (title, id_in_bx, assigned_by_id) VALUES (?, ?, ?)';
                const insertParams = [company.TITLE, company.ID, company.ASSIGNED_BY_ID];
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

async function getMaxId(table) {
    try {
        let query = `SELECT MAX(id_in_bx) as maxId FROM `;
        switch (table.toLowerCase()) {
            case "companies":
                query += `companies`;
                break;
            case "deals":
                query += `deals`;
                break;
        }
        const params = [];
        const rows = await executeQuery(query, params);

        if (rows.length > 0) {
            return rows[0].maxId;
        } else {
            return null; // No deals found for the given 
        }
    } catch (error) {
        logError("getMaxId", error);
        return null; // Propagate error further if necessary
    }
}

async function addDealsToDb(deals) {
    try {
        const insertPromises = deals.map(async (deal) => {
            const checkQuery = 'SELECT COUNT(*) AS count FROM deals WHERE id_in_bx = ?';
            const checkParams = [deal.ID];
            const [rows] = await executeQuery(checkQuery, checkParams);

            if (rows.count === 0) {
                const paymentDate = deal.PAYMENT_DATE?.toString() === "" ? null : deal.PAYMENT_DATE?.toString();
                const createDate = deal.DATE_CREATE?.toString() === "" ? null : deal.DATE_CREATE?.toString();
                const companyId = deal.COMPANY_ID?.toString() === "0" ? null : deal.COMPANY_ID;
                // Company does not exist, insert it
                const insertQuery = 'INSERT INTO deals (title, company_id, date_create, payment_date, opportunity, id_in_bx) VALUES (?, ?, ?, ?, ?, ?)';
                const insertParams = [deal.TITLE, companyId, createDate, paymentDate, deal.OPPORTUNITY, deal.ID];
                return executeQuery(insertQuery, insertParams);
            } else {
                // Company already exists, handle as needed (maybe update or skip)
                return null; // Return null or handle differently if needed
            }
        })
        return await Promise.all(insertPromises);
    } catch (error) {
        logError("addDealsToDb", error);
        return null;
    }
}

async function addBxLink(bxName, link, key) {
    try {
        const encryptedText = encrypt(link, key);

        // Insert encrypted link into MySQL database
        const query = 'INSERT INTO credentials (bx_name, link) VALUES (?, ?)';
        await executeQuery(query, [bxName, encryptedText]);

        return true;
    } catch (error) {
        logError("init_bx addBxLink", error);
    }
}

async function getBxCredentials(bxName, key) {
    try {
        // Fetch encrypted link from MySQL database
        const query = 'SELECT * FROM credentials WHERE bx_name = ?';
        const result = await executeQuery(query, [bxName]);

        if (result.length > 0) {
            const encryptedLink = result[0].link;
            const decryptedLink = decrypt(encryptedLink, key);

            return { id: result[0].id, link: decryptedLink, bx: result[0].bx_name }
        } else {
            throw new Error(`No Bitrix link found for ${bxName}`);
        }
    } catch (error) {
        logError("init_bx getBxCredentials", error);
    }
}

async function setSummary() {
    try {
        // Check if a summary row exists for the 
        const checkQuery = `
            SELECT COUNT(*) AS count
            FROM summary
        `;
        const checkParams = [];
        const checkResult = await executeQuery(checkQuery, checkParams);

        if (checkResult[0].count > 0) {
            // Update existing row
            const updateQuery = `
                UPDATE summary
                SET companies_count = ?,
                    deals_count = ?,
                    last_deal_date = ?
            `;
            const companiesCount = await getCompaniesCount();
            const dealsCount = await getDealsCount();
            const lastDealDate = await getLastDealDateFromDeals();
            const updateParams = [companiesCount, dealsCount, lastDealDate];

            await executeQuery(updateQuery, updateParams);
        } else {
            // Insert new row
            const insertQuery = `
                INSERT INTO summary (companies_count, deals_count, last_deal_date)
                VALUES (?, ?, ?)
            `;
            const companiesCount = await getCompaniesCount();
            const dealsCount = await getDealsCount();
            const lastDealDate = await getLastDealDateFromDeals();
            const insertParams = [companiesCount, dealsCount, lastDealDate];

            await executeQuery(insertQuery, insertParams);
        }

        // Optionally, return a success message or indication
        return true;
    } catch (error) {
        logError("setSummary", error);
        return null; // Propagate error further if necessary
    }
}

async function getLastDealDateFromSummary() {
    try {
        const query = `SELECT last_deal_date AS lastDealDate FROM summary`;
        const params = [];
        const rows = await executeQuery(query, params);

        if (rows.length > 0) {
            return rows[0].lastDealDate;
        } else {
            return null; // No deals found for the given 
        }
    } catch (error) {
        logError("getLastDealDateFromSummary", error);
        return null; // Propagate error further if necessary
    }
}

async function getLastDealDateFromDeals() {
    try {
        let query = `
            SELECT MAX(date_create) AS lastDealDate
            FROM deals
           
        `;
        const params = [];
        const rows = await executeQuery(query, params);

        if (rows.length > 0) {
            return rows[0].lastDealDate;
        } else {
            return null; // No deals found for the given 
        }
    } catch (error) {
        logError("getLastDealDateFromDeals", error);
        return null; // Propagate error further if necessary
    }
}

async function getDealsCount() {
    try {
        let query = `
            SELECT COUNT(*) AS count
            FROM deals
        `;
        const params = [];
        const rows = await executeQuery(query, params);

        if (rows.length > 0) {
            return rows[0].count;
        } else {
            return null; // No deals found for the given 
        }
    } catch (error) {
        logError("getDealsCount", error);
        return null; // Propagate error further if necessary
    }
}

async function getCompaniesCount() {
    try {
        let query = `
            SELECT COUNT(*) AS count
            FROM companies
        `;
        const params = [];
        const rows = await executeQuery(query, params);

        if (rows.length > 0) {
            return rows[0].count;
        } else {
            return null; // No deals found for the given 
        }
    } catch (error) {
        logError("getCompaniesCount", error);
        return null; // Propagate error further if necessary
    }
}

async function markOnCall(data, assignedById, table) {
    try {
        let query = `UPDATE`

        switch (table.toLowerCase()) {
            case "companies":
                query += ` companies`;
                break;
        }
        query += ` SET on_call = true, assigned_by_id = ? WHERE id_in_bx = ?`;

        for (const item of data) {
            await executeQuery(query, [parseInt(assignedById), item]);
        }

    } catch (error) {
        logError("markOnCall", error);
        return null;
    }
}

async function checkIfExists(bxName) {
    try {
        const query = 'SELECT COUNT(*) AS count FROM credentials WHERE bx_name = ?';
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

module.exports = { addBxLink, getBxCredentials, checkIfExists, setConnection, addCompaniesToDb, addDealsToDb, setSummary, getLastDealDateFromSummary, getMaxId, getFromDb, markOnCall };

function setConnection(conn) {
    connection = conn;
}