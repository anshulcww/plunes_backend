const express = require('express')
const mongoose = require('mongoose')
const fs = require('fs')
const fileType = require('file-type')
const User = require('../models/user')
const Catalogue = require('../models/catalogue')
const auth = require('../middleware/auth')
const { COUPON_CODES } = require('../config')

const router = express.Router()

const ObjectId = mongoose.Types.ObjectId

// Create a user
router.post('/register', async (req, res) => {
    try {
        // console.log(req.body)
        const user = new User(req.body)
        user.userReferralCode = newReferralCode()
        await user.save()
        if (user.referralCode) {
            const u = await User.findOne({
                userReferralCode: user.referralCode
            })
            if (u) {
                u.credits += 100
                await u.save()
                user.credits = 100
                await user.save()
            }
        }
        const token = await user.generateAuthToken()
        res.status(201).send({
            success: true,
            user,
            token
        })
    } catch (error) {
        const match = /E11000 duplicate key error.+index: (\w+)_/.exec(error.errmsg)
        var message = ''
        if (match) {
            switch (match[1]) {
                case 'email':
                    message = 'Email is already registered!'
                    break
                case 'mobileNumber':
                    message = 'Mobile Number is already registered!'
                    break
                default:
                    message = 'Invalid request!'
            }
            res.status(201).send({
                success: false,
                message: message
            })
        } else {
            console.log(error)
            res.status(400).send({
                success: false,
                message: error.errmsg
            })
        }
    }
})

// Login request
router.post('/login', async (req, res) => {
    try {
        // console.log(req.body)
        const {
            mobileNumber,
            password,
            deviceId
        } = req.body
        const user = await User.findByCredentials(mobileNumber, password)
        const token = await user.generateAuthToken()
        if (deviceId != null) {
            user.deviceIds = user.deviceIds.filter((d) => d != deviceId)
            user.deviceIds = user.deviceIds.concat(deviceId)
        }
        console.log(user)
        await user.save()
        res.status(201).json({
            success: true,
            user,
            token
        })
    } catch (error) {
        console.log(error)
        res.status(400).send({
            success: false,
            error
        })

    }
})

// Logout request
router.post('/logout', auth, async (req, res) => {
    try {
        // console.log(req.token)
        const index = req.user.tokens.findIndex(t => t.token == req.token)
        req.user.tokens = req.user.tokens.filter((token) => {
            return token.token != req.token
        })

        const deviceId = req.user.deviceIds[index]
        req.user.deviceIds = req.user.deviceIds.filter((d) => d != deviceId)

        await req.user.save()
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
        const data = req.body

        if (data.name) {
            req.user.name = data.name
        }

        if (data.email) {
            req.user.email = data.email
        }

        if (data.address) {
            req.user.address = data.address
        }

        if (data.registrationNumber) {
            req.user.registrationNumber = data.registrationNumber
        }

        if (data.qualification) {
            req.user.qualification = data.qualification
        }

        if (data.biography) {
            req.user.biography = data.biography
        }

        if (data.practising) {
            req.user.practising = data.practising
        }

        if (data.college) {
            req.user.college = data.college
        }

        if (data.imageUrl) {
            req.user.imageUrl = data.imageUrl
        }

        if (data.coverImageUrl) {
            req.user.coverImageUrl = data.coverImageUrl
        }

        if (data.latitude) {
            req.user.geoLocation.latitude = data.latitude
        }

        if (data.longitude) {
            req.user.geoLocation.longitude = data.longitude
        }

        if (data.timeSlots) {
            req.user.timeSlots = data.timeSlots
        }

        if (data.achievement) {
            req.user.achievements = req.user.achievements.concat(data.achievement)
        }

        if (data.bankDetails) {
            req.user.bankDetails = data.bankDetails
        }

        if (req.user.userType == 'Hospital' && data.doctors) {
            data.doctors.forEach(function (doctor) {
                if (doctor.doctorId) {
                    req.user.doctors.forEach(function (d) {
                        if (d._id.toString() == doctor.doctorId) {
                            d.name = doctor.name ? doctor.name : d.name
                            d.education = doctor.education ? doctor.education : d.education
                            d.designation = doctor.designation ? doctor.designation : d.designation
                            d.department = doctor.department ? doctor.department : d.department
                            d.experience = doctor.experience ? doctor.experience : d.experience
                            d.availability = doctor.availability ? doctor.availability : d.availability
                            d.imageUrl = doctor.imageUrl ? doctor.imageUrl : d.imageUrl
                            d.timeSlots = doctor.timeSlots ? doctor.timeSlots : d.timeSlots
                        }
                    })
                } else {
                    req.user.doctors = req.user.doctors.concat({
                        name: doctor.name,
                        education: doctor.education,
                        designation: doctor.designation,
                        department: doctor.department,
                        experience: doctor.experience,
                        availability: doctor.availability,
                        imageUrl: doctor.imageUrl,
                        timeSlots: doctor.timeSlots,
                        specialities: doctor.specialities
                    })
                    doctor.specialities.forEach((s1) => {
                        const index = req.user.specialities.findIndex((s2) => s1.specialityId == s2.specialityId)
                        if (index == -1) {
                            req.user.specialities = req.user.specialities.concat({
                                specialityId: s1.specialityId
                            })
                        }
                    })
                }
            })
        }

        const specialities = req.user.specialities

        if (data.services) {
            data.services.forEach(function (service) {
                if (service.price == 0 || service.price.length == 0 || service.price[0] == 0) {
                    return
                }
                specialities.forEach(function (speciality) {
                    if (speciality.specialityId == service.specialityId) {
                        speciality.services = speciality.services.filter((s) => {
                            return s.serviceId != service.serviceId
                        })
                        speciality.services = speciality.services.concat({
                            serviceId: service.serviceId,
                            price: [service.price],
                            variance: service.variance,
                            homeCollection: false,
                            category: ['Basic']
                        })
                    }
                })

            })
        }

        if (data.specialityId && data.serviceId && data.price && data.variance) {
            specialities.forEach(function (speciality) {
                if (speciality.specialityId == data.specialityId) {
                    speciality.services = speciality.services.concat({
                        serviceId: data.serviceId,
                        price: data.price,
                        variance: data.variance
                    })
                }
            })
        }

        if (data.prescription) {
            if (data.prescription.logoUrl) {
                req.user.logoUrl = data.prescription.logoUrl
                req.user.logoText = ""
            }
            if (data.prescription.logoText) {
                console.log("Logo Text", data.prescription.logoText)
                req.user.logoText = data.prescription.logoText
            }
            if (data.prescription.doctorId) {
                let index = req.user.doctors.findIndex(d => d._id.toString() == data.prescription.doctorId)
                if (index != -1) {
                    req.user.doctors[index].prescription = data.prescription
                }
            } else {
                req.user.prescription = data.prescription
            }
        }

        const validCoupons = COUPON_CODES
        console.log("STUFF", data.coupon, req.user.coupons, validCoupons, req.user.coupons.findIndex(c => c === data.coupon))
        console.log("Inside stuff")
        if (data.coupon) {
            if (validCoupons.indexOf(data.coupon) === -1) {
                console.log("Invalid coupon")
                res.status(201).send({
                    success: false,
                    message: 'Please enter a valid coupon!'
                })
            } else if ((req.user.coupons.findIndex(c => c === data.coupon) !== -1)) {
                res.status(201).send({
                    success: false,
                    message: 'This coupon has already been used!'
                })
            }
            req.user.coupons = req.user.coupons.addToSet(data.coupon)
            await req.user.save()
            res.status(201).send({
                success: true
            })
        } else {
            await req.user.save()
            res.status(201).send({
                success: true
            })
        }
    } catch (error) {
        console.log(error)
        res.status(400).send(error)
    }
})

router.put('/update_password', async (req, res) => {
    try {
        console.log(req.body)
        const {
            mobileNumber,
            password
        } = req.body
        const user = await User.findOne({
            mobileNumber: mobileNumber
        })
        if (user) {
            user.password = password
            await user.save()
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

router.get('/', async (req, res) => {
    // console.log(req.query)
    try {
        if (req.query.mobileNumber) {
            // console.log('Mobile Number:', req.query.mobileNumber)
            const user = await User.findOne({
                mobileNumber: req.query.mobileNumber
            })
            const response = Boolean(user) ? {
                success: true,
                user: user
            } : {
                    success: false
                }
            // console.log(response)
            res.status(201).send(response)
        }
        if (req.query.specialityId) {
            const users = await User.find({
                "specialities.specialityId": req.query.specialityId
            }, {
                name: 1,
                imageUrl: 1,
                address: 1
            })
            res.status(201).send({
                success: true,
                users: users
            })
        }
        if (req.query.userId) {
            const user = await User.findOne({
                _id: ObjectId(req.query.userId)
            })
            delete user.tokens
            // console.log({user})
            res.status(201).send({
                success: true,
                user
            })
        }
    } catch (error) {
        console.log(error)
        res.status(400).send(error)
    }
})

router.get('/whoami', auth, async (req, res) => {
    res.status(201).send(req.user)
})

router.post('/logout_all', auth, async (req, res) => {
    try {
        req.user.tokens = []
        req.user.deviceIds = []
        await req.user.save()
        res.status(201).send({
            success: true
        })
    } catch (error) {
        res.status(400).send(error)
    }
})

router.get('/:id/:field', async (req, res) => {
    try {
        const id = req.params.id
        const field = req.params.field
        if (field == 'tokens') {
            res.status(201).send({
                success: true,
                message: 'Nice try!'
            })
        }
        const user = await User.findOne({
            _id: ObjectId(req.params.id)
        })
        if (!user) {
            res.status(201).send({
                success: false,
                message: 'user not found'
            })
        } else {
            res.status(201).send({
                success: true,
                field: user[field]
            })
        }
    } catch (error) {
        console.log(error)
        res.status(400).send(error)
    }
})

router.get('/:id/:field/:fieldId/:subField', async (req, res) => {
    try {
        const id = req.params.id
        const field = req.params.field
        const fieldId = req.params.fieldId
        const subField = req.params.subField

        if (field == 'tokens') {
            res.status(201).send({
                success: true,
                message: 'Nice try!'
            })
        }
        const user = await User.findOne({
            _id: ObjectId(req.params.id)
        })
        if (!user) {
            res.status(201).send({
                success: false,
                message: 'user not found'
            })
        } else {
            const element = user[field].find(element => element._id.toString() == fieldId)
            if (element) {
                res.status(201).send({
                    success: true,
                    field: element[subField]
                })
            } else {
                res.status(201).send({
                    success: false,
                    error: 'data not found'
                })
            }
        }
    } catch (error) {
        console.log(error)
        res.status(400).send(error)
    }
})

router.delete('/:serviceId', auth, async (req, res) => {
    var deleted = false
    req.user.specialities.forEach(function (speciality) {
        if (speciality.specialityId == service.specialityId) {
            speciality.services = speciality.services.filter((s) => {
                if (s.serviceId == req.params.serviceId) {
                    deleted = true
                }
                return s.serviceId != req.params.serviceId
            })
        }
    })
    res.status(201).send({
        success: deleted
    })
})

router.post('/upload', auth, async function (req, res) {
    try {
        const buffer = new Buffer.from(req.body.data, 'base64')
        const ext = fileType(buffer).ext
        const filename = req.user._id.toString() + '_' + Date.now() + '.' + ext
        fs.writeFileSync('./data/' + filename, buffer)
        res.status(201).send({
            success: true,
            url: 'data/' + filename
        })
    } catch (error) {
        console.log(error)
        res.status(400).send({
            success: false
        })
    }
})

router.delete('/:field/:id', auth, async (req, res) => {
    try {
        const field = req.params.field
        const id = req.params.id
        if (field in req.user) {
            // console.log(req.user[field])
            req.user[field] = req.user[field].filter((value) =>
                value._id.toString() != id
            )
            await req.user.save()
            res.status(201).send({
                success: true,
                message: 'field updated'
            })
            return
        }
        res.status(201).send({
            success: false,
            message: 'nothing changed'
        })
    } catch (error) {
        console.log(error)
        res.status(400).send(error)
    }
})

router.put('/update', async (req, res) => {
    try {
        const data = req.body

        const user = await User.findOne({
            mobileNumber: data.mobileNumber
        })
        if (!user) {
            res.status(201).send({
                success: false
            })
            return
        }

        if (data.name) {
            user.name = data.name
        }

        if (data.email) {
            user.email = data.email
        }

        if (data.address) {
            user.address = data.address
        }

        if (data.registrationNumber) {
            user.registrationNumber = data.registrationNumber
        }

        if (data.qualification) {
            user.qualification = data.qualification
        }

        if (data.biography) {
            user.biography = data.biography
        }

        if (data.practising) {
            user.practising = data.practising
        }

        if (data.college) {
            user.college = data.college
        }

        if (data.imageUrl) {
            user.imageUrl = data.imageUrl
        }

        if (data.coverImageUrl) {
            user.coverImageUrl = data.coverImageUrl
        }

        if (data.latitude) {
            user.geoLocation.latitude = data.latitude
        }

        if (data.longitude) {
            user.geoLocation.longitude = data.longitude
        }

        if (data.timeSlots) {
            user.timeSlots = data.timeSlots
        }

        if (data.achievement) {
            user.achievements = user.achievements.concat(data.achievement)
        }

        if (data.bankDetails) {
            user.bankDetails = data.bankDetails
        }

        if (user.userType == 'Hospital' && data.doctors) {
            data.doctors.forEach(function (doctor) {
                if (doctor.doctorId) {
                    user.doctors.forEach(function (d) {
                        if (d._id.toString() == doctor.doctorId) {
                            d.name = doctor.name ? doctor.name : d.name
                            d.education = doctor.education ? doctor.education : d.education
                            d.designation = doctor.designation ? doctor.designation : d.designation
                            d.department = doctor.department ? doctor.department : d.department
                            d.experience = doctor.experience ? doctor.experience : d.experience
                            d.availability = doctor.availability ? doctor.availability : d.availability
                            d.imageUrl = doctor.imageUrl ? doctor.imageUrl : d.imageUrl
                            d.timeSlots = doctor.timeSlots ? doctor.timeSlots : d.timeSlots
                        }
                    })
                } else {
                    user.doctors = user.doctors.concat({
                        name: doctor.name,
                        education: doctor.education,
                        designation: doctor.designation,
                        department: doctor.department,
                        experience: doctor.experience,
                        availability: doctor.availability,
                        imageUrl: doctor.imageUrl,
                        timeSlots: doctor.timeSlots,
                        specialities: doctor.specialities
                    })
                    doctor.specialities.forEach((s1) => {
                        const index = user.specialities.findIndex((s2) => s1.specialityId == s2.specialityId)
                        if (index == -1) {
                            user.specialities = user.specialities.concat({
                                specialityId: s1.specialityId
                            })
                        }
                    })
                }
            })
        }

        const specialities = user.specialities

        if (data.services) {
            data.services.forEach(function (service) {
                if (service.price.length == 0 || service.price[0] == 0) {
                    return
                }
                specialities.forEach(function (speciality) {
                    if (speciality.specialityId == service.specialityId) {
                        speciality.services = speciality.services.filter((s) => {
                            return s.serviceId != service.serviceId
                        })
                        speciality.services = speciality.services.concat({
                            serviceId: service.serviceId,
                            price: [service.price],
                            variance: service.variance,
                            homeCollection: false,
                            category: ['Basic']
                        })
                    }
                })

            })
        }

        if (data.service) {
            const [specialityId, serviceId] = await Catalogue.findServiceDetails(data.service)
            // console.log(specialityId, serviceId)
            const index = user.specialities.findIndex(s => s.specialityId == specialityId)
            // console.log('index:', index)
            if (index == -1) {
                user.specialities = user.specialities.concat({
                    specialityId: specialityId,
                    services: [{
                        serviceId: serviceId,
                        price: [parseInt(data.price)],
                        variance: parseInt(data.variance),
                        homeCollection: false,
                        category: ['Basic']
                    }]
                })
                console.log('Added:', specialityId, serviceId)
            } else {
                const i = user.specialities[index].services.findIndex(s => s.serviceId == serviceId)
                if (i == -1) {
                    user.specialities[index].services = user.specialities[index].services.concat({
                        serviceId: serviceId,
                        price: [parseInt(data.price)],
                        variance: parseInt(data.variance),
                        homeCollection: false,
                        category: ['Basic']
                    })
                    console.log('Added:', serviceId)
                }
            }
        }

        if (data.specialityId && data.serviceId && data.price && data.variance) {
            specialities.forEach(function (speciality) {
                if (speciality.specialityId == data.specialityId) {
                    speciality.services = speciality.services.concat({
                        serviceId: data.serviceId,
                        price: data.price,
                        variance: data.variance
                    })
                }
            })
        }

        await user.save()

        res.status(201).send({
            success: true
        })
    } catch (error) {
        console.log(error)
        res.status(400).send(error)
    }
})

function newReferralCode() {
    const r = Math.random
    const p = parseInt
    const a = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'
    return a[p(r() * 26)] + a[p(r() * 26)] + a[p(r() * 26)] + a[p(r() * 26)] + p(r() * 10) + p(r() * 10) + p(r() * 10) + p(r() * 10)
}

/*
router.get('/referral', async (req, res) => {
    const users = await User.find({})
    for (var user of users) {
        console.log(user.name)
        user.userReferralCode = newReferralCode()
        await user.save()
    }
    res.status(201).send({
        success: true
    })
})
*/

router.post('/upsert', async (req, res) => {
    try {
        let messages = []
        for (var r of req.body) {
            const u = await User.findOne({
                mobileNumber: r.mobileNumber
            })
            if (u) {
                const sp = await Catalogue.findOne({
                    speciality: r.speciality
                })
                if (sp) {
                    let i = sp.services.findIndex(x => x.service == r.service)
                    if (i != -1) {
                        let j = u.specialities.findIndex(x => x.specialityId == sp._id.toString())
                        if (j != -1) {
                            let k = u.specialities[j].services.findIndex(x => x.serviceId == sp.services[i]._id.toString())
                            if (k != -1) {
                                u.specialities[j].services[k].price = r.price
                                u.specialities[j].services[k].variance = r.variance
                                u.specialities[j].services[k].homeCollection = r.homeCollection
                                u.specialities[j].services[k].category = r.category
                            }
                            messages = messages.concat('Service updated: ' + r.service)
                        } else {
                            u.specialities = u.specialities.concat({
                                specialityId: sp.services[i]._id.toString(),
                                services: [{
                                    serviceId: sp.services[i]._id.toString(),
                                    price: r.price,
                                    variance: r.variance,
                                    homeCollection: r.homeCollection,
                                    category: r.category
                                }]
                            })
                            messages = messages.concat('Service added: ' + r.service)
                        }
                        await u.save()
                    } else {
                        messages = messages.concat('Invalid service: ' + r.service)
                    }
                } else {
                    messages = messages.concat('Invalid speciality: ' + r.speciality)
                }
            }
        }
        res.status(201).send({
            success: true,
            messages: messages
        })
    } catch (error) {
        console.log(error)
        res.status(400).send(error)
    }
})

module.exports = router