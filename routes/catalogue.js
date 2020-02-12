const express = require('express')
const fs = require('fs')
const xlsx = require('node-xlsx')

const Catalogue = require('../models/catalogue')
const User = require('../models/user')
const auth = require('../middleware/auth')

router = express.Router()

var catalogue = undefined

router.get('/', async (req, res) => {
    try {
        if (!catalogue) {
            catalogue = await Catalogue.find({})
        }
        res.status(201).send(catalogue)
    } catch (error) {
        res.status(400).send('missing catalogue')
    }
})

router.post('/search', async (req, res) => {
    if (req.body.expression.length > 3) {
        try {
            const catalogue = await Catalogue.aggregate([{
                $match: {
                    $text: { $search: `\"${req.body.expression}\"` }
                }
            },
            {
                $project: {
                    serviceName: {
                        $filter: {
                            input: '$services',
                            as: 'services',
                            cond: {
                                "$regexMatch": { "input": '$$services.service', "regex": `/${req.body.expression}/` }
                            }
                        }
                    },
                    _id: 0
                }
            },
            {
                $unwind: "$serviceName"
            },
            {
                $project: {
                    _id: "$serviceName._id",
                    service: "$serviceName.service",
                    details: "$serviceName.details",
                    tags: "$serviceName.tags",
                    category: "$serviceName.category"
                }
            }
            ])
            res.status(200).send(catalogue)
        } catch (e) {
            console.log("Error", e)
            res.status(400).send(null)
        }
    } else {
        res.status(400).send(null)
    }
})

const addService = async (user, specialityId, serviceId, price, variance, homeCollection, category) => {
    console.log(specialityId, serviceId, price, variance, homeCollection, category)
    var index = user.specialities.findIndex(s => s.specialityId == specialityId)
    if (index == -1) {
        user.specialities = user.specialities.concat({
            specialityId: specialityId,
            services: []
        })
        index = user.specialities.length - 1
    }
    if (user.specialities[index].services.findIndex(s => s.serviceId == serviceId) == -1) {
        user.specialities[index].services = user.specialities[index].services.concat({
            serviceId: serviceId,
            price: price,
            variance: variance,
            homeCollection: homeCollection,
            category: category
        })
        await user.save()
    }
}

router.post('/upsert', async (req, res) => {
    try {
        let messages = []
        for (var r of req.body) {
            const s = await Catalogue.findOne({
                speciality: r.speciality
            })
            if (s) {
                const i = s.services.findIndex(s => s.service == r.service)
                if (i == -1) {
                    s.services = s.services.concat({
                        service: r.service,
                        details: r.details,
                        duration: r.duration,
                        sittings: r.sittings,
                        dnd: r.dnd,
                        tags: r.tags,
                        category: r.category
                    })
                    messages = messages.concat(r.service + ' added!')
                } else {
                    s.services[i].details = r.details
                    s.services[i].duration = r.duration
                    s.services[i].sittings = r.sittings
                    s.services[i].dnd = r.dnd
                    s.services[i].tags = r.tags
                    s.services[i].category = r.category
                    messages = messages.concat(r.service + ' updated!')
                }
                await s.save()
            }
            messages = messages.concat('Invalid speciality: ' + r.speciality)
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

// router.get('/anjali', async (req, res) => {
//     const u = await User.mobileNumberExists('9818345055')
//     const d = JSON.parse(fs.readFileSync('./plunes-db/anjali.json'))
//     for (var s of d) {
//         const a = await Catalogue.findServiceDetails(s.name)
//         if (a.length > 0 && s.procedure_price > 0) {
//             console.log('Added:', s.name)
//             await addService(u, a[0], a[1], [s.procedure_price], s.procedure_variance, false, ['Basic'])
//         } else {
//             console.log('Not added:', s.name)
//         }
//     }

//     res.status(201).send({
//         success: true
//     })
// })

// router.get('/opth', async (req, res) => {
//     const data = JSON.parse(fs.readFileSync('./plunes-db/chirag.json'))
//     var s = await Catalogue.findOne({
//         speciality: /Ophthal/
//     })
//     // console.log(s.speciality)
//     // for (var r of data[0].data) {
//     //     // console.log(r)
//     //     if (!r[1] || r[0] == 'CODE') {
//     //         continue
//     //     }
//     //     // const d = await Catalogue.findServiceDetails(r[1])
//     //     // console.log(d)
//     //     const index = s.services.findIndex(v => v.service == r[1])
//     //     console.log(index)
//     //     if (index != -1) {
//     //         console.log('Fixing:', r[1])
//     //         s.services[index].details = r[2]
//     //         s.services[index].dnd = r[3]
//     //         s.services[index].tags = r[4]

//     //         // s.services = s.services.concat({
//     //         //     service: r[1],
//     //         //     details: r[2],
//     //         //     dnd: r[3],
//     //         //     tags: r[4]
//     //         // })
//     //     } else {
//     //         console.log('Not adding:', r[1])
//     //     }
//     // }
//     // await s.save()
//     const u = await User.findOne({
//         name: /Chirag/
//     })
//     console.log(u.name)
//     for (var r of data) {
//         console.log(r)
//         const d = await Catalogue.findServiceDetails(r.PROCEDURE)
//         console.log(d)
//         if (d.length > 0) {
//             console.log('Adding:', r.PROCEDURE)
//             await addService(u, d[0], d[1], [r['GENERAL WARD'], r['SEMI PRIVATE'], r['PRIVATE'], r['DELUXE']], 25, false, ['General Ward', 'Semi Private', 'Private', 'Deluxe'])
//         }
//     }
//     res.status(201).send({
//         success: true
//     })
// })

router.get('/check_services', async (req, res) => {
    const users = await User.find({})
    const catalogue = await Catalogue.find({})
    var good = 0,
        bad = 0
    for (var u of users) {
        for (var s of u.specialities) {
            const a = s.specialityId
            for (var v of s.services) {
                const b = v.serviceId
                const i = catalogue.findIndex(c => c._id.toString() == a)
                if (i != -1) {
                    const j = catalogue[i].services.findIndex(x => x._id.toString() == b)
                    if (j != -1) {
                        // console.log(u.name, a, b, 'Ok!')
                        good++
                        continue
                    }
                }
                // console.log(u.name, await Catalogue.findSpecialityName(a), await Catalogue.findServiceName(b), 'Error!')
                console.log(u.name)
                bad++
            }
        }
    }
    console.log(good, bad)
    res.status(201).send({
        success: true
    })
})

/*
router.get('/addsome', async (req, res) => {
    try {
        const a = ['Psychiatrist', 'Diebtology', 'Oncologist', 'Audiologist', 'Urology', 'Allergist', 'Plastic Surgeon', 'Vet', 'Obstetrics']
        for (var s of a) {
            console.log(s)
            const e = new Catalogue({
                speciality: s,
                services: [{
                    service: s + ' Consultation'
                }]
            })
            await e.save()
        }
        res.status(201).send({
        })
            success: true
    } catch (error) {
        res.status(400).send(error)
    }
})
*/

module.exports = router