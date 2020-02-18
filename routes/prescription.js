const express = require('express')
const fs = require('fs')
const pdf = require("pdf-creator-node")
const auth = require('../middleware/auth')

const {
    execFileSync
} = require('child_process')

const User = require('../models/user')
const Prescription = require('../models/prescription')
const Report = require('../models/report')
const Notification = require('../models/notification')

const router = express.Router()

router.post('/', auth, async (req, res) => {
    try {
        const user = req.user
        console.log(req.body);
        const prescription = new Prescription(req.body)
        let prescriptionTemplate = user.prescription
        if (prescription.doctorId) {
            console.log(prescription.doctorId, 'doc id')
            let i = user.doctors.findIndex(x => x._id.toString() == prescription.doctorId)
            if (i != -1) {
                prescriptionTemplate = user.doctors[i].prescription;
                console.log('prescription', prescriptionTemplate)
            }
            prescriptionTemplate['mobileNumber'] = user.mobileNumber;
            prescriptionTemplate['email'] = user.email;

        }
        if (prescriptionTemplate) {
            const html = fs.readFileSync('./prescription.html')
            const options = {
                format: 'A4',
                orientation: 'portrait',
                border: '10mm'
            }
            const filename = '' + Date.now() + '-prescription.pdf'
            const document = {
                html: html.toString(),
                data: {
                    prescriptionTemplate: prescriptionTemplate,
                    prescriptionData: prescription.prescriptionData
                },
                path: './public/' + filename
            }
            await pdf.create(document, options)
            prescription.prescriptionUrl = 'https://plunes.co/v4/public/' + filename
        }
        await prescription.save()
        const patient = await User.findById(prescription.patientId)
        if (patient) {
            console.log(patient.name)
            const report = new Report({
                userId: prescription.userId,
                self: false,
                patientMobileNumber: patient.mobileNumber,
                reportUrl: prescription.prescriptionUrl,
                createdTime: Date.now()
            })
            await report.save()
            const filename = '.' + report.reportUrl.slice(report.reportUrl.indexOf('/public'))
            console.log(filename)
            execFileSync('/usr/bin/convert', [filename + '[0]', filename + '.thumbnail.png'])
            const message = `Hi! Your prescription is now available in your PLOCKR account. Kindly open the Plunes app to view.`
            const notification = new Notification({
                userId: prescription.patientId,
                senderUserId: prescription.userId,
                notificationType: 'plockr'
            })
            await Notification.sms(report.patientMobileNumber, message)
            if (patient.deviceIds && patient.deviceIds.length > 0) {
                // console.log(user.name)
                await Notification.push(patient.deviceIds, 'Plockr Report', message, 'plockr')
            }
        }
        res.status(201).send({
            success: true,
            url: prescription.prescriptionUrl
        })
    } catch (error) {
        console.log(error)
        res.status(400).send(error)
    }
})

router.post('/test', auth, async (req, res) => {
    try {
        const user = req.user
        console.log(req.body);
        const prescription = new Prescription(req.body)
        let prescriptionTemplate = user.prescription
        if (prescription.doctorId) {
            console.log(prescription.doctorId, 'doc id')
            let i = user.doctors.findIndex(x => x._id.toString() == prescription.doctorId)
            if (i != -1) {
                prescriptionTemplate = user.doctors[i].prescription;
                console.log('prescription', prescriptionTemplate)
            }
            prescriptionTemplate['mobileNumber'] = user.mobileNumber;
            prescriptionTemplate['email'] = user.email;

        }
        if (prescriptionTemplate) {
            console.log({prescriptionTemplate}, prescriptionTemplate.logoUrl, prescriptionTemplate.logoText)
            let html
            if(prescriptionTemplate.logoUrl !== "") {
                html = fs.readFileSync('./prescription_logo.html')
            } else {
                html = fs.readFileSync('./prescription_text.html')
            }
            const options = {
                format: 'A4',
                orientation: 'portrait',
                border: '10mm'
            }
            const filename = '' + Date.now() + '-prescription_test.pdf'
            let fields = prescription.prescriptionData.fields.map(element => { return {key: Object.keys(element)[0], value: Object.values(element)[0]}})
            console.log({fields})
            const document = {
                html: html.toString(),
                data: {
                    prescriptionTemplate: prescriptionTemplate,
                    prescriptionData: prescription.prescriptionData,
                    fields
                },
                path: './public/' + filename
            }
            await pdf.create(document, options)
            prescription.prescriptionUrl = 'https://plunes.co/v4/public/' + filename
        }
        await prescription.save()
        const patient = await User.findById(prescription.patientId)
        if (patient) {
            console.log(patient.name)
            const report = new Report({
                userId: prescription.userId,
                self: false,
                patientMobileNumber: patient.mobileNumber,
                reportUrl: prescription.prescriptionUrl,
                createdTime: Date.now()
            })
            await report.save()
            const filename = '.' + report.reportUrl.slice(report.reportUrl.indexOf('/public'))
            console.log(filename)
            execFileSync('/usr/bin/convert', [filename + '[0]', filename + '.thumbnail.png'])
            const message = `Hi! Your prescription is now available in your PLOCKR account. Kindly open the Plunes app to view.`
            const notification = new Notification({
                userId: prescription.patientId,
                senderUserId: prescription.userId,
                notificationType: 'plockr'
            })
            await Notification.sms(report.patientMobileNumber, message)
            if (patient.deviceIds && patient.deviceIds.length > 0) {
                // console.log(user.name)
                await Notification.push(patient.deviceIds, 'Plockr Report', message, 'plockr')
            }
        }
        res.status(201).send({
            success: true,
            url: prescription.prescriptionUrl
        })
    } catch (error) {
        console.log(error)
        res.status(400).send(error)
    }
})

router.get('/', auth, async (req, res) => {
    try {
        const prescriptions = await Prescription.getPrescriptionForUser(req.user._id.toString())
        res.status(201).send({
            success: true,
            prescriptions
        })
    } catch (error) {
        console.log(error)
        res.status(400).send(error)
    }
})

module.exports = router