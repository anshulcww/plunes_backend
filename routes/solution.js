const express = require('express')
const mongoose = require('mongoose')

const Solution = require('../models/solution')
const User = require('../models/user')
const Notification = require('../models/notification')
const Catalogue = require('../models/catalogue')
const auth = require('../middleware/auth')

const router = express.Router()

const ObjectId = mongoose.Types.ObjectId

router.get('/', auth, async (req, res) => {
    try {
        const serviceId = req.query.serviceId
        // console.log('ServiceId:', serviceId)
        const user = req.user
        var solution = await Solution.findOne({
            serviceId: serviceId,
            userId: user._id.toString()
        })
        if (solution && (Date.now() - solution.createdTime) > 600000) {
            solution.services.forEach((service) => {
                service.negotiating = false
            })
        }
        if (!solution || (Date.now() - solution.createdTime) > 3600000) {
            if (solution && (Date.now() - solution.createdTime) > 3600000) {
                Solution.deleteOne({
                    _id: solution._id
                })
            }
            const services = await User.findServices(serviceId, user)
            var totalPrice = 0
            services.forEach((service) => {
                totalPrice += service.newPrice[0]
            })
            const averagePrice = parseInt(totalPrice / services.length)
            for (var i = 0; i < services.length; i++) {
                const service = services[i]
                if (service.newPrice[0] <= averagePrice) {
                    service.recommendation = 0
                } else {
                    const percentage = ((service.newPrice[0] - averagePrice) / service.newPrice[0]) * 100
                    service.recommendation = parseInt(percentage / 5) * 5
                }
                if (((service.newPrice[0] - averagePrice) / averagePrice) > 0.15) {
                    service.negotiating = true
                    const professional = await User.findById(service.professionalId)
                    if (professional) {
                        let c = await Catalogue.findServiceId(serviceId)
                        if (c) {
                            c.services = c.services.filter((s) => s._id.toString() == serviceId)
                            const serviceName = c.services[0].service
                            const notification = new Notification({
                                userId: service.professionalId,
                                senderUserId: user._id.toString(),
                                notificationType: 'solution'
                            })
                            await notification.save()
                            await Notification.sms(professional.mobileNumber, `${user.name} is looking for ${serviceName} near you. We recommend you to update the fee at the earliest.`)
                            if (professional.deviceIds.length > 0) {
                                await Notification.push(professional.deviceIds, 'Fee alert', `${user.name} is looking for ${serviceName} near you. We recommend you to update the fee at the earliest.`, 'solution')
                            }
                        }
                    }
                } else {
                    service.negotiating = false
                }
            }
            solution = new Solution({
                serviceId: serviceId,
                userId: user._id.toString(),
                name: user.name,
                imageUrl: user.imageUrl,
                createdTime: Date.now(),
                services: services
            })
            await solution.save()
        }
        // console.log(solution)
        res.status(201).send({
            success: true,
            solution
        })
    } catch (error) {
        console.log(error)
        res.status(400).send(error)
    }
})

router.get('/search', auth, async (req, res) => {
    try {
        var personalSolutions = await Solution.findSolutionsByUserId(req.user._id.toString())
        personalSolutions = personalSolutions.filter((s) => (Date.now() - s.createdTime) < 3600000)
        personalSolutions.forEach(function(solution) {
            // console.log('Search ServiceId:', solution.serviceId)
            if ((Date.now() - solution.createdTime) > 60000000) {
                console.log("Negotiation timeout", (Date.now() - solution.createdTime), Date.now(), solution.createdTime )
                solution.services.forEach(function(service) {
                    service.negotiating = false
                })
            }
        })
        // console.log(personalSolutions)
        var businessSolutions = []
        for (var i = 0; i < req.user.specialities.length; i++) {
            for (var j = 0; j < req.user.specialities[i].services.length; j++) {
                const serviceId = req.user.specialities[i].services[j].serviceId
                const businessSolution = await Solution.findSolutionsByServiceId(serviceId)
                businessSolutions = businessSolutions.concat(businessSolution)
            }
        }
        if (req.user.userType == 'Hospital') {
            for (var k = 0; k < req.user.doctors.length; k++) {
                for (var i = 0; i < req.user.doctors[k].specialities.length; i++) {
                    for (var j = 0; j < req.user.doctors[k].specialities[i].services.length; j++) {
                        const serviceId = req.user.doctors[k].specialities[i].services[j].serviceId
                        const businessSolution = await Solution.findSolutionsByServiceId(serviceId)
                        businessSolutions = businessSolutions.concat(businessSolution)
                    }
                }
            }
        }
        businessSolutions = businessSolutions.filter((s) => (Date.now() - s.createdTime) < 3600000)
        businessSolutions.forEach((solution) => {
            solution.services.filter((s) => s.userId == req.user._id.toString)
        })
        // console.log(businessSolutions)
        res.status(201).send({
            success: true,
            personal: personalSolutions,
            business: businessSolutions
        })
    } catch (error) {
        console.log(error)
        res.status(400)
    }
})

router.put('/', auth, async (req, res) => {
    try {
        const {
            solutionId,
            serviceId,
            updatedPrice
        } = req.body
        const solution = await Solution.findOne({
            _id: ObjectId(solutionId)
        })
        const index = solution.services.findIndex(s => s._id.toString() == serviceId)
        if (index != -1) {
            solution.services[index].newPrice = updatedPrice
            solution.services[index].discount = parseInt(((solution.services[index].price[0] - solution.services[index].newPrice[0]) / solution.services[index].price[0]) * 100)
            solution.services[index].negotiating = false
            await solution.save()
            const user = await User.findById(solution.userId)
            const professional = await User.findById(solution.services[index].professionalId)
            if (user && professional) {
                await Notification.sms(user.mobileNumber, `You have received an updated fee from ${professional.name}. We recommend you to book at the earliest, as it is valid for only an hour.`)
                if (user.deviceIds.length != 0) {
                    await Notification.push(user.deviceIds, 'Fee alert', `You have received an updated fee from ${professional.name}. We recommend you to book at the earliest, as it is valid for only an hour.`, 'solution')
                }
                const notification = new Notification({
                    userId: solution.userId,
                    senderUserId: solution.services[index].professionalId,
                    notificationType: 'solution update'
                })
                await notification.save()
            }
            res.status(201).send({
                success: true
            })
        } else {
            res.status(201).send({
                success: false
            })
        }
    } catch (error) {
        console.log(error)
        res.status(400).send(error)
    }
})

module.exports = router
