require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const policyRoutes = require('./routes/policyRoutes');
const scheduleRoutes = require('./routes/scheduleRoutes');
// const { monitorCPU } = require('./server_cpu_monitor'); // If you put CPU logic here

const app = express();
const PORT = process.env.PORT || 3000;
const DB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/policyDB';

// Middleware
app.use(express.json());

// Database Connection
mongoose.connect(DB_URI)
    .then(() => console.log('MongoDB Connected Successfully!'))
    .catch(err => {
        console.error('MongoDB Connection Error:', err);
        process.exit(1);
    });

// Routes
app.use('/api', policyRoutes);
app.use('/api', scheduleRoutes);

app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
    // monitorCPU(); // Start CPU monitoring
});



const os = require('os');

const CPU_THRESHOLD = process.env.CPU_THRESHOLD || 70; 
const INTERVAL_MS =  5000; // Check every 5 seconds

/**
 * Calculates the current average CPU usage as a percentage.
 * @param {Array} startCpus - CPU info from os.cpus() at start time
 * @param {Array} endCpus - CPU info from os.cpus() at end time
 * @returns {number} The average CPU usage in percent.
 */
const getCpuUsage = (startCpus, endCpus) => {
    let totalIdle = 0, totalTick = 0;

    for (let i = 0; i < startCpus.length; i++) {
        const start = startCpus[i];
        const end = endCpus[i];
        
        // Calculate total time for each CPU
        const idle = end.times.idle - start.times.idle;
        const total = Object.values(end.times).reduce((sum, val) => sum + val, 0) - 
                      Object.values(start.times).reduce((sum, val) => sum + val, 0);

        totalIdle += idle;
        totalTick += total;
    }

    // Calculate average usage
    const usage = 1 - (totalIdle / totalTick);
    return Math.round(usage * 100);
};

let startCpus = os.cpus();

const monitorCPU = () => {
    setTimeout(() => {
        const endCpus = os.cpus();
        const currentUsage = getCpuUsage(startCpus, endCpus);
        
        console.log(`[CPU MONITOR] Current CPU Usage: ${currentUsage}%`);

        if (currentUsage > CPU_THRESHOLD) {
            console.error(`[CPU MONITOR] Threshold (${CPU_THRESHOLD}%) exceeded. Restarting server...`);
            process.exit(1); 
        }

        startCpus = endCpus; // Update for the next check
        monitorCPU(); // Schedule the next check
    }, INTERVAL_MS);
};

// Start the monitoring
monitorCPU(); 