const express = require('express');
const { Worker } = require('worker_threads');
const multer = require('multer'); // Requires `npm install multer`
const path = require('path');
const router = express.Router();
const fs = require('fs')

const upload = multer({ dest: 'uploads/' }); 
const DB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/policyDB'; 

// 1. API to upload XLSX/CSV data
router.post('/upload', upload.single('file'), (req, res) => {
    if (!req.file) {
        return res.status(400).send('No file uploaded.');
    }

    const filePath = path.resolve(req.file.path);

    // Create a new worker thread
    const worker = new Worker(path.resolve(__dirname, '../worker/dataImporter.js'), {
        workerData: { filePath, dbUri: DB_URI },
    });

    // Listen for messages from the worker
    worker.on('message', (msg) => {
        console.log(`[WORKER MESSAGE]: ${msg.message}`);

    });

    worker.on('error', (err) => {
        console.error(`[WORKER ERROR]: ${err}`);
    });

    worker.on('exit', (code) => {
        if (code !== 0) {
            console.error(`Worker stopped with exit code ${code}`);
        }
        // Clean up the temporary file
        fs.unlink(filePath, () => {}); 
    });

    res.status(202).json({ 
        message: 'File upload initiated. Data processing is running in the background.', 
        fileName: req.file.originalname 
    });
});

const { User, Policy } = require('../models'); // Import models

// 2. Search API to find policy info with the help of the username (first_name)
router.get('/policies/search', async (req, res) => {
   const username = req.body.username;

    try {
        // Find the user by first_name
        const user = await User.findOne({ first_name: { $regex: new RegExp(username, 'i') } });

        if (!user) {
            return res.status(404).json({ message: 'User not found.' });
        }

        // Find policies associated with the user, and populate all related info
        const policies = await Policy.find({ user_id: user._id })
            .populate('policy_category_id', 'category_name') // LOB
            .populate('company_collection_id', 'company_name') // Carrier
            .populate('agent_id', 'agent_name') // Agent
            .populate('account_id', 'account_name') // User's Account
            .exec();

        res.status(200).json({ 
            user: user,
            policies: policies 
        });
    } catch (error) {
        res.status(500).json({ message: 'Internal Server Error', error: error.message });
    }
});


// 3. API to provide aggregated policy by each user
router.get('/policies/aggregated', async (req, res) => {
    try {
        const aggregationResult = await Policy.aggregate([
            // 1. Group policies by user_id and count them
            {
                $group: {
                    _id: "$user_id",
                    total_policies: { $sum: 1 }
                }
            },
            // 2. Look up the User details using the _id (which is the user_id)
            {
                $lookup: {
                    from: 'users', // The name of the User collection
                    localField: '_id',
                    foreignField: '_id',
                    as: 'userDetails'
                }
            },
            // 3. Deconstruct the userDetails array (it will have one element)
            {
                $unwind: '$userDetails'
            },
            // 4. Project the final desired output fields
            {
                $project: {
                    _id: 0,
                    userId: '$_id',
                    userName: '$userDetails.first_name',
                    userEmail: '$userDetails.email',
                    totalPolicies: '$total_policies'
                }
            }
        ]);

        res.status(200).json(aggregationResult);
    } catch (error) {
        res.status(500).json({ message: 'Internal Server Error', error: error.message });
    }
});

module.exports = router;