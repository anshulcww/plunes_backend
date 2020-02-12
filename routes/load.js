const express = require('express')
const fs = require('fs')

const Catalogue = require('../models/catalogue')
const User = require('../models/user')

const router = express.Router()

router.get('/catalogue/:filename', async (req, res) => {
    try {
        const filename = req.params.filename
        await Catalogue.deleteMany({})
        await Catalogue.refreshCatalogue(`./plunes-db/${filename}.json`)
        res.status(201).send({
            success: true
        })
    } catch (error) {
        console.log(error)
        res.status(400).send('unable to refresh')
    }
})


router.get('/RD', async (req, res) => {
    const u = await User.mobileNumberExists('9312438109')
    console.log(u.name)
    const d = JSON.parse(fs.readFileSync('./plunes-db/rd.json'))
    for (var i = 0; i < d.length; i++) {
        const s = d[i]
        if (s.price) {
            // console.log(s.tests)
            const [s1, s2] = await Catalogue.findServiceDetails(s.tests)
            if (!s1) {
                continue
            }
            console.log('Adding:', s.tests)
            const index = u.specialities.findIndex((x) => x.specialityId)
            if (index == -1) {
                u.specialities = u.specialities.concat({
                    specialityId: s1,
                    services: [{
                        serviceId: s2,
                        price: [parseInt(s.price)],
                        variance: 45,
                        homeCollection: false,
                        category: ['Basic']
                    }]
                })
            } else {
                u.specialities[index].services = u.specialities[index].services.concat({
                    serviceId: s2,
                    price: [parseInt(s.price)],
                    variance: 45,
                    homeCollection: false,
                    category: ['Basic']
                })
            }
        }
    }
    await u.save()
    res.status(201).send({
        success: true
    })
})

router.get('/services', async (req, res) => {
    const d = await User.find({
        userType: {
            $ne: 'User'
        }
    })
    for (var i = 0; i < d.length; i++) {
        const u = d[i]
        for (var s of u.specialities) {
            for (var p of s.services) {
                const a = await Catalogue.findServiceName(s.specialityId, p.serviceId)
                if (a) {
                    const r = u.name + '|' + u.mobileNumber + '|' + a[0] + '|' + a[1] + '|' + p.price + '|' + p.variance + '|' + p.category
                    console.log(r)
                }
            }
        }
    }
    res.status(201).send({
        success: true
    })
})

/*
router.get('/clean', async (req, res) => {
    const m = await Catalogue.findSpeciality('Miscellaneous')
    let c = m.services.map((x) => x)
    m.services.forEach((s) => {
        c = c.filter((x) => x.service != s.service || x._id == s._id)
    })
    // console.log(c)
    m.services = c
    await m.save()
    res.status(201).send({success: true})
})
*/

/*
router.get('/sheet', async (req, res) => {
    const d = fs.readFileSync('./plunes-db/sheet.txt').toString()
    const M = await Catalogue.findSpeciality('Miscellaneous')
    for (var l of d.split('\n')) {
        console.log(l)
        const [n, m, s, p, v] = l.split('|')
        const u = await User.mobileNumberExists(m)
        if (u) {
            const [a, b] = await Catalogue.findServiceDetails(s)
            if (a) {
                const i = u.specialities.findIndex((x) => x.specialityId == a)
                console.log('Adding:', s)
                if (i == -1) {
                    u.specialities = u.specialities.concat({
                        specialityId: a,
                        services: [{
                            serviceId: b,
                            price: [parseInt(p)],
                            variance: parseInt(v),
                            homeCollection: false,
                            category: ['Basic']
                        }]
                    })
                } else {
                    const j = u.specialities[i].services.findIndex((x) => x.serviceId == b)
                    if (j == -1) {
                        // console.log('Adding:', s)
                        u.specialities[i].services = u.specialities[i].services.concat({
                            serviceId: b,
                            price: [parseInt(p)],
                            variance: parseInt(v),
                            homeCollection: false,
                            category: ['Basic']
                        })
                    }
                }
                await u.save()
            } else {
                console.log('Missing:', s)
                // M.services = M.services.concat({
                //     service: s,
                //     details: '',
                //     duration: 0,
                //     sittings: 1,
                //     dnd: '',
                //     tags: '',
                //     category: 'Test'
                // })
                // await M.save()
            }
        }
        // console.log('Line:', l)
    }
    // await M.save()
    res.status(201).send({success: true})
})
*/

/*
router.get('/hp', async (req, res) => {
    const h = JSON.parse(fs.readFileSync('./plunes-db/healthpckg.json'))
    const c = new Catalogue({
        speciality: 'Health Package'
    })
    await c.save()
    for (p of h) {
        c.services = c.services.concat(p)
    }
    await c.save()
    res.status(201).send({
        success: true
    })
})
*/

/*
router.get('/121619', async (req, res) => {
    try {
        const s = JSON.parse(fs.readFileSync('./plunes-db/labomed.json'))
        const u = await User.mobileNumberExists('7838428005')
        console.log(u.name)
        const m = await Catalogue.findSpeciality('Miscellaneous')
        console.log(m)
        for (var p of s) {
            const [a, b] = await Catalogue.findServiceDetails(p['Test Name'])
            if (a) {
                const index = u.specialities.findIndex((s) => s.specialityId == a)
                if (index == -1) {
                    // u.specialities = u.specialities.concat({specialityId: a})
                } else {
                    u.specialities[index].services = u.specialities[index].services.concat({
                        serviceId: b,
                        price: [parseInt(p.price)],
                        variance: 45,
                        homeCollection: false,
                        category: ['Basic']
                    })
                }
                // await u.save()
            }
            await u.save()
        }
        res.status(201).send({success: true})
    } catch (error) {
        console.log(error)
        res.status(400).send(error)
    }
})
*/

/*
router.get('/newdocs', async (req, res) => {
    try {
        const docs = JSON.parse(fs.readFileSync('./plunes-db/newdocs.json'))
        for (var i = 0; i < docs.length; i++) {
            const d = docs[i]
            const u_ = await User.mobileNumberExists(d.mobileNumber.toString())
            if (u_) {
                console.log('Added:', d.name)
                continue
            }
            if (d['consultation fees'] == '' || d['speciality'] == '' || d.email == '') {
                console.log('Not added:', d.name)
                continue
            }
            var [specialityId, serviceId] = await Catalogue.findServiceDetails(d['speciality'] + ' Consultation')
            if (!specialityId) {
                [specialityId, serviceId] = await Catalogue.findServiceDetails(d['speciality'] + ' Consultation + Xray (Single Film)')
                if (!specialityId) {
                    console.log('Not added:', d.name)
                    continue
                }
            }
            const u = new User({
                name: d.name,
                userType: 'Doctor',
                biography: d.biography,
                address: d.address,
                email: d.email,
                registrationNumber: d.registrationNumber,
                mobileNumber: d.mobileNumber.toString(),
                specialities: [{
                    specialityId: specialityId,
                    services: [{
                        serviceId: serviceId,
                        price: [d['consultation fees']],
                        variance: 25,
                        homeCollection: false,
                        category: ['Basic']
                    }]
                }],
                password: '12345678',
                timeSlots: [{
                        "slots": [
                            "9:00 AM-1:00 PM",
                            "3:00 PM-8:00 PM"
                        ],
                        "day": "monday",
                        "closed": false
                    },
                    {
                        "slots": [
                            "9:00 AM-1:00 PM",
                            "3:00 PM-8:00 PM"
                        ],
                        "day": "tuesday",
                        "closed": false
                    },
                    {
                        "slots": [
                            "9:00 AM-1:00 PM",
                            "3:00 PM-8:00 PM"
                        ],
                        "day": "wednesday",
                        "closed": false
                    },
                    {
                        "slots": [
                            "9:00 AM-1:00 PM",
                            "3:00 PM-8:00 PM"
                        ],
                        "day": "thursday",
                        "closed": false
                    },
                    {
                        "slots": [
                            "9:00 AM-1:00 PM",
                            "3:00 PM-8:00 PM"
                        ],
                        "day": "friday",
                        "closed": false
                    },
                    {
                        "slots": [
                            "9:00 AM-1:00 PM",
                            "3:00 PM-8:00 PM"
                        ],
                        "day": "saturday",
                        "closed": false
                    },
                    {
                        "slots": [
                            "9:00 AM-1:00 PM",
                            "3:00 PM-8:00 PM"
                        ],
                        "day": "sunday",
                        "closed": true
                    }
                ]
            })
            console.log('Added: ', u.name)
            await u.save()
        }
        res.status(201).send({
            success: true
        })
    } catch (error) {
        console.log(error)
        res.status(400).send(error)
    }
})
*/

/*
router.get('/user/:filename', async (req, res) => {
    try {
        const filename = req.params.filename
        const data = JSON.parse(fs.readFileSync(`./plunes-db/${filename}.json`))
        const achievements = JSON.parse(fs.readFileSync('./plunes-db/achievements.json'))
        var a = {}
        achievements.forEach(function(e) {
            if (e.user_id in a) {
                a[e.user_id] = a[e.user_id].concat({
                    title: e.achievement_title,
                    achievement: e.achievement_body,
                    imageUrl: e.imageUrl
                })
            } else {
                a[e.user_id] = [{
                    title: e.achievement_title,
                    achievement: e.achievement_body,
                    imageUrl: e.imageUrl
                }]
            }
        })
        const timeSlots = JSON.parse(fs.readFileSync('./plunes-db/business_hours.json'))
        var t = {}
        const days = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday']
        timeSlots.forEach(function(s) {
            // console.log(s.user_id)
            t[s.user_id] = []
            for (var day of days) {
                // console.log(day)
                if (day in s) {
                    if ('slot2' in s[day]) {
                        t[s.user_id] = t[s.user_id].concat({
                            day: day,
                            slots: [s[day].slot1.from + '-' + s[day].slot1.to, s[day].slot2.from + '-' + s[day].slot2.to],
                            closed: s[day].check
                        })
                    } else {
                        t[s.user_id] = t[s.user_id].concat({
                            day: day,
                            slots: [s[day].slot1.from + '-' + s[day].slot1.to],
                            closed: s[day].check
                        })
                    }
                }
            }
        })
        // console.log(t)
        for (var i = 0; i < data.length; i++) {
            const u = data[i]
            // console.log(u.name)
            const U = await User.mobileNumberExists(u.phone_number)
            if (U) {
                // console.log(u.phone_number, 'already exists!')
                continue
            }
            switch (u.user_type) {
                case 'General User':
                    // const user = new User({
                    //     name: u.name,
                    //     email: u.email,
                    //     mobileNumber: u.phone_number,
                    //     userType: 'User',
                    //     password: '12345678',
                    //     verifiedUser: true,
                    //     address: u.user_location,
                    //     geoLocation: {
                    //         latitude: u.geolocation.coordinates[1],
                    //         longitude: u.geolocation.coordinates[0]
                    //     },
                    //     deviceIds: u.device
                    // })
                    // await user.save()
                    // await User.updateOne({
                    //     mobileNumber: user.mobileNumber
                    // }, {
                    //     $set: {
                    //         password: u.hash
                    //     }
                    // })
                    break
                case 'Hospital':
                    //const D = await User.mobileNumberExists(u.phone_number)
                    //if (D) {
                    //    console.log('Mobile Number already exists:', D.mobileNumber)
                    //    break
                    //}
                    const catalogue = u.catalogue
                    h = {}
                    // console.log(u._id.$oid)
                    for (const service of catalogue) {
                        if (service.procedure_price == 0 || service.procedure_price == undefined) {
                            continue
                        }
                        const d = await Catalogue.findServiceDetails(service.name)
                        if (d.length != 0) {
                            // console.log(d)
                            if (d[0] in h) {
                                h[d[0]] = h[d[0]].concat({
                                    serviceId: d[1],
                                    price: [service.procedure_price],
                                    variance: service.procedure_variance,
                                    homeCollection: false,
                                    category: ['Basic']
                                })
                            } else {
                                h[d[0]] = [{
                                    serviceId: d[1],
                                    price: [service.procedure_price],
                                    variance: service.procedure_variance,
                                    category: ['Basic']
                                }]
                            }
                        } else {
                            console.log(`${u.name}|${u.phone_number}|${service.name}|${service.procedure_price}|${service.procedure_variance}`)
                        }
                    }
                    var specialities = []
                    for (var k in h) {
                        specialities = specialities.concat({
                            specialityId: k,
                            services: h[k]
                        })
                    }
                    var ac = []
                    if (u._id.$oid in a) {
                        ac = a[u._id.$oid]
                    }
                    var ts = []
                    if (u._id.$oid in t) {
                        ts = t[u._id.$oid]
                    }
                    // console.log(specialities)
                    const doctor = new User({
                        name: u.name,
                        email: u.email,
                        mobileNumber: u.phone_number,
                        userType: 'Hospital',
                        password: '12345678',
                        verifiedUser: true,
                        address: u.user_location,
                        geoLocation: {
                            latitude: u.geolocation.coordinates[1],
                            longitude: u.geolocation.coordinates[0]
                        },
                        specialities: specialities,
                        imageUrl: u.imageUrl ? u.imageUrl : 'https://www.plunes.com/upload/pic/default-profile-pic.jpg',
                        qualification: u.qualification,
                        biography: u.specialistbio,
                        registrationNumber: u.professional_registration_number,
                        experience: parseInt(u.experience) ? parseInt(u.experience) : 0,
                        timeSlots: ts,
                        practising: u.practising,
                        college: u.college,
                        achievements: ac,
                        deviceIds: u.device
                    })
                    // console.log(specialities)
                    await doctor.save()
                    await User.updateOne({
                        mobileNumber: doctor.mobileNumber
                    }, {
                        $set: {
                            password: u.hash
                        }
                    })
                    console.log(doctor.mobileNumber, 'added!')
                    break
                case 'Doctor':
                    break
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
*/

/*
router.get('/opt', async (req, res) => {
    const c = new Catalogue({
        speciality: 'Optometrist',
        services: [{
            service: 'Optometrist Consultation',
            details: '',
            duration: 0,
            sittings: 1,
            dnd: '',
            tags: 'optometrist',
            category: 'Consultation'
        }]
    })
    await c.save()
    res.status(201).send({
        success: true
    })
})
*/

module.exports = router