const express = require('express')
const fs = require('fs')

const Report = require('../models/report')
const Notification = require('../models/notification')
const User = require('../models/user')
const Catalogue = require('../models/catalogue')
const auth = require('../middleware/auth')

const router = express.Router()

router.post('/', auth, async (req, res) => {
    try {
        console.log(req.body)
        const report = new Report(req.body)
        console.log(req.body, 'body')
        report.createdTime = Date.now()
        report.reportUrl = report.reportUrl.replace(/ /g, '%20')
        await report.save()
        // const speciality = await Catalogue.findSpecialityId(report.specialityId)
        // const specialityName = speciality ? speciality.speciality : 'Plockr'
        const message = `Hi! Your prescription is now available in your PLOCKR account. Kindly open the Plunes app to view.`
        await Notification.sms(report.patientMobileNumber, message)
        const user = await User.mobileNumberExists(report.patientMobileNumber)
        if (user && user.deviceIds && user.deviceIds.length > 0) {
            // console.log(user.name)
            await Notification.push(user.deviceIds, 'Plockr Report', message, 'plockr')
        }
        res.status(201).send({
            success: true
        })
    } catch (error) {
        console.log(error)
        res.status(400).send(error)
    }
})

router.post('/test', auth, async (req, res) => {
    const asyncForEach = async (array, callback) => {
        for (let index = 0; index < array.length; index++) {
            await callback(array[index], index, array);
        }
    }
    try {
        // console.log(req.body)
        if(req.body.report.length > 0) {
            await asyncForEach(req.body.report, async element => {
                console.log({element})
                const report = new Report({
                    userId: req.body.userId,
                    self: req.body.self,
                    reportName: element.reportName,
                    reportUrl: element.reportUrl.replace(/ /g, '%20'),
                    createdTime: Date.now()
                })
                await report.save().then(docs => console.log("Saved report", docs))
            })
        }
        // const speciality = await Catalogue.findSpecialityId(report.specialityId)
        // const specialityName = speciality ? speciality.speciality : 'Plockr'
        // const message = `Hi! Your prescription is now available in your PLOCKR account. Kindly open the Plunes app to view.`
        // Send notifications -----
        // await Notification.sms(report.patientMobileNumber, message)
        // const user = await User.mobileNumberExists(report.patientMobileNumber)
        // if (user && user.deviceIds && user.deviceIds.length > 0) {
        //     // console.log(user.name)
        //     await Notification.push(user.deviceIds, 'Plockr Report', message, 'plockr')
        // }
        res.status(201).send({
            success: true
        })
    } catch (error) {
        console.log(error)
        res.status(400).send(error)
    }
})

router.put('/', auth, async (req, res) => {
    try {
        console.log(req.body)
        const reportId = req.body.reportId
        const report = await Report.findById(reportId)
        report.specialityId = req.body.specialityId ? req.body.specialityId : report.specialityId
        report.reportName = req.body.reportName ? req.body.reportName : report.reportName
        report.test = req.body.test ? req.body.test : report.test
        report.patientMobileNumber = req.body.patientMobileNumber ? req.body.patientMobileNumber : report.patientMobileNumber
        report.problemAreaDiagnosis = req.body.problemAreaDiagnosis ? req.body.problemAreaDiagnosis : report.problemAreaDiagnosis
        report.reasonDiagnosis = req.body.reasonDiagnosis ? req.body.reasonDiagnosis : report.reasonDiagnosis
        report.consumptionDiet = req.body.consumptionDiet ? req.body.consumptionDiet : report.consumptionDiet
        report.avoidDiet = req.body.avoidDiet ? req.body.avoidDiet : report.avoidDiet
        report.precautions = req.body.precautions ? req.body.precautions : report.precautions
        report.medicines = req.body.medicines ? req.body.medicines : report.medicines
        report.remarks = req.body.remarks ? req.body.remarks : report.remarks
        report.createdTime = Date.now()
        await report.save()
        const message = `Hi! Your report is now available in your PLOCKR account. Kindly open the Plunes app to view.`
        await Notification.sms(report.patientMobileNumber, message)
        const user = await User.mobileNumberExists(report.patientMobileNumber)
        if (user && user.deviceIds && user.deviceIds.length > 0) {
            // console.log(user.name)
            await Notification.push(user.deviceIds, 'Plockr Report', message, 'plockr')
        }
        res.status(201).send({
            success: true
        })
    } catch (error) {
        console.log(error)
        res.status(400).send(error)
    }
})

router.post('/upload', async (req, res) => {
    try {
        console.log(req.body)
        const report = new Report(req.body)
        report.createdTime = Date.now()
        report.reportUrl = report.reportUrl.replace(/ /g, '%20')
        await report.save()
        res.status(201).send({
            success: true
        })
    } catch (error) {
        console.log(error)
        res.status(400).send(error)
    }
})

router.put('/share', auth, async (req, res) => {
    try {
        // console.log(req.body)
        const {
            reportId,
            userId
        } = req.body
        const report = await Report.findById(reportId)
        if (report) {
            if (report.userId == req.user._id.toString() || report.mobileNumber == req.user.mobileNumber) {
                report.accessList = report.accessList.concat({
                    userId: userId,
                    accessType: 'r'
                })
            }
        }
        res.status(201).send({
            success: true
        })
    } catch (error) {
        console.log(error)
        res.status(400).send(error)
    }
})

router.get('/', auth, async (req, res) => {
    try {
        const personalReports = await Report.findPersonalReports(req.user._id.toString(), req.user.mobileNumber)
        // console.log(personalReports)
        const businessReports = await Report.findBusinessReports(req.user._id.toString())
        // console.log(businessReports)
        res.status(201).send({
            success: true,
            personalReports: personalReports,
            businessReports: businessReports
        })
    } catch (error) {
        console.log(error)
        res.status(400).send(error)
    }
})

router.delete('/:id', auth, async (req, res) => {
    try {
        const reportId = req.params.id
        const result = await Report.deleteById(reportId)
        res.status(201).send({
            success: true,
            result: result
        })
    } catch (error) {
        console.log(error)
        res.status(400).send(error)
    }
})

module.exports = router
