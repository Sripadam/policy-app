
const express = require('express');
const schedule = require('node-schedule');
const router = express.Router();

const { ScheduledMessage } = require('../models'); 



const scheduledJobs = {};


router.post('/schedule-message', async (req, res) => {
    // Expected format: day='2025-12-25', time='14:30:00'
    const { message, day, time } = req.body; 

    if (!message || !day || !time) {
        return res.status(400).json({ message: 'Missing parameters: message, day (YYYY-MM-DD), or time (HH:MM:SS).' });
    }
    
   
    const scheduledDateTimeStr = `${day}T${time}Z`; 
    const scheduledDate = new Date(scheduledDateTimeStr);
    
    if (isNaN(scheduledDate.getTime())) {
         return res.status(400).json({ message: 'Invalid date or time format. Please use YYYY-MM-DD and HH:MM:SS.' });
    }
    
    // Check if the scheduled time is in the future
    if (scheduledDate < new Date()) {
         return res.status(400).json({ message: 'Cannot schedule a message in the past.' });
    }

    // Generate a unique name for the job
    const jobName = `msg-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;

    // Schedule the one-time job using node-schedule
    const job = schedule.scheduleJob(jobName, scheduledDate, async () => {
        try {
            
            await ScheduledMessage.create({
                message: message,
                scheduledAt: scheduledDate, // Use the originally scheduled time
            });
            console.log(`[SCHEDULER] Successfully inserted job: ${jobName} at ${new Date().toISOString()}`);
            
            // Clean up the job from the in-memory store after execution
            delete scheduledJobs[jobName];
        } catch (error) {
            console.error(`[SCHEDULER ERROR] Job ${jobName} failed to insert message: ${error.message}`);
        }
    });

    if (job) {
        scheduledJobs[jobName] = job;
        return res.status(201).json({ 
            message: 'Message scheduled successfully for one-time insertion.',
            scheduledFor: scheduledDate.toISOString(),
            jobName: job.name
        });
    } else {
         return res.status(500).json({ message: 'Failed to create scheduler job.' });
    }
});

module.exports = router; 