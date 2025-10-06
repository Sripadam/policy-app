const { parentPort, workerData } = require('worker_threads');
const mongoose = require('mongoose');
const path = require('path');
const xlsx = require('xlsx'); 


const models = require('../models/index.js');
const { Agent, User, Account, LOB, Carrier, Policy } = models; 
// Connect to MongoDB
const connectDB = async () => {
    try {
        await mongoose.connect(workerData.dbUri);
        parentPort.postMessage({ status: 'info', message: 'Worker connected to MongoDB.' });
    } catch (error) {
        parentPort.postMessage({ status: 'error', message: 'DB connection failed in worker.', error: error.message });
        throw error;
    }
};
async function processRows(rows) {
    let inserted = 0;
    for (const r of rows) {
        try {
            // upsert Agent
            let agent = null;
            if (r.agent) {
                agent = await Agent.findOneAndUpdate(
                    { agent_name: r.agent }, 
                    { agent_name: r.agent }, 
                    { upsert: true, new: true }
                );
            }

            // upsert User
            const userData = {
                first_name: r.firstname || r.first_name || r.name || null,
                dob: r.dob ? new Date(r.dob) : null,
                address: r.address || null,
                phone_number: r.phone || null,
                state: r.state || null,
                zip_code: r.zip || r.postal || null, 
                email: r.email || null,
                gender: r.gender || null,
                userType: r.userType || null
            };
            let user = null;
            if (userData.email) {
                user = await User.findOneAndUpdate({ email: userData.email }, userData, { upsert: true, new: true });
            } else if (userData.firstname) {
                 
                 user = new User(userData);
                 await user.save();
            } else {
                 // Skip record if no key identifier is available for the user
                 continue;
            }

            let account = null;
            if (r.account_name && user) {
                account = await Account.findOneAndUpdate(
                    { account_name: r.account_name }, 
                    { account_name: r.account_name, user_id: user._id }, 
                    { upsert: true, new: true }
                );
            }

            let lob = null;
            if (r.category_name) {

                lob = await LOB.findOneAndUpdate(
                    { category_name: r.category_name }, 
                    { category_name: r.category_name }, 
                    { upsert: true, new: true }
                );
            }

            // upsert Carrier
            let carrier = null;
            if (r.company_name) {
                carrier = await Carrier.findOneAndUpdate(
                    { company_name: r.company_name }, 
                    { company_name: r.company_name }, 
                    { upsert: true, new: true }
                );
            }

            if (!user || !lob || !carrier || !agent || !account) {
                 console.warn(`Skipping policy record due to missing required foreign key (User, LOB, Carrier, Agent, or Account) for policy: ${r.policyNumber}`);
                 continue;
            }
            
            const policy = new Policy({
                policy_number: r.policyNumber || r.policy_number || null,
                policy_start_date: r.policyStartDate ? new Date(r.policyStartDate) : (r.policy_start_date ? new Date(r.policy_start_date) : null),
                policy_end_date: r.policyEndDate ? new Date(r.policyEndDate) : (r.policy_end_date ? new Date(r.policy_end_date) : null),
                
                policy_category_id: lob._id,      
                company_collection_id: carrier._id, 
                user_id: user._id,
                agent_id: agent._id,
                account_id: account._id, 
            });
            await policy.save();
            inserted++;
        } catch (innerError) {
             console.error(`Error processing row for policy ${r.policyNumber || 'N/A'}: ${innerError.message}`);
        }
    }
    return inserted;
}

const importData = async () => {
    try {
        await connectDB();
        const filePath = workerData.filePath;
        
        const workbook = xlsx.readFile(filePath);
        const sheetName = workbook.SheetNames[0];
        const data = xlsx.utils.sheet_to_json(workbook.Sheets[sheetName]);

        parentPort.postMessage({ status: 'info', message: `Found ${data.length} records. Starting insert...` });
        
        const inserted = await processRows(data);
        
        parentPort.postMessage({ status: 'success', message: `Successfully inserted ${inserted} records.` });

    } catch (error) {
        console.error('Worker: Import Process Failed:', error.stack || error.message);
        parentPort.postMessage({ 
            status: 'error', 
            message: 'Data import failed at a high level. Check worker console for stack trace.', 
            error: error.message 
        });
    } finally {
        await mongoose.disconnect(); 
    }
};

importData();