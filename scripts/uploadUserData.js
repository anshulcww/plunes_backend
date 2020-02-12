const mongoose = require('mongoose')
const fs = require('fs')
const xlsx = require('node-xlsx')

const Config = require('../config')

mongoose.connect(Config.MONGODB_URL, {
    useNewUrlParser: true,
    useCreateIndex: true,
    useUnifiedTopology: true
})

const Catalogue = require('../models/catalogue')
const User = require('../models/user')

const loadXlsxFile = async (filename) => {
    const data = xlsx.parse(fs.readFileSync(filename))

    for (var sheet of [data[0]]) {
        console.log(sheet.name)
        for (var row of sheet.data) {
            console.log(row)
            const m = row[1]
            const sp = row[2]
            const se = row[4]
            let p = row[5]
            let c = []
            if (typeof p == 'string') {
                p = p.split(',').map(x => parseInt(x))
                c = ['General Ward', 'Semi Private', 'Private,Deluxe']
            } else {
                p = [p]
                c = ['Basic']
            }
            const v = row[6]
            // console.log(mobileNumber, procedure, [price], variance * 100, false, ['Basic'])
            const result = await addServiceForUser(m, sp, se, p, v, false, c)
            console.log(result)
        }
    }
}

async function addServiceForUser(m, sp, se, p, v, h, c) {
    const u = await User.findOne({
        mobileNumber: m
    })
    if (!u) {
        return 'User not found'
    }
    console.log(u.name)
    const d = await Catalogue.findServiceDetails(se)
    console.log(d)
    if (d.length == 0) {
        return 'Invalid service: ' + se
    }
    let i = u.specialities.findIndex(x => x.specialityId == d[0])
    if (i == -1) {
        u.specialities = u.specialities.concat({
            specialityId: d[0],
            services: []
        })
    }
    i = u.specialities.length - 1
    let j = u.specialities[i].services.findIndex(x => x.serviceId == d[1])
    if (j == -1) {
        console.log('Adding new service')
        u.specialities[i].services = u.specialities[i].services.concat({
            serviceId: d[1],
            price: p,
            variance: v,
            homeCollection: h,
            category: c
        })
    } else {
        console.log('Updating service')
        u.specialities[i].services[j].price = p
        u.specialities[i].services[j].variance = v
        u.specialities[i].services[j].homeCollection = h
        u.specialities[i].services[j].category = c
    }
    await u.save()
    return 'Service added'
}

loadXlsxFile('./plunes-db/sd.xlsx').then(() => {
    console.log('Done!')
})