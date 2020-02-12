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
        for (var row of sheet.data) {
            const speciality = row[0]
            const actualSpeciality = row[1]
            const service = row[2]
            const actualService = row[3]
            const category = row[4]
            const actualCategory = row[5]
            // const details = row[3]
            // const duration = row[4]
            // const sittings = row[4]
            // const dnd = row[6]
            // const tags = row[7]
            // const category = row[7]

            if (!actualService) {
                continue
            }
            const result = await updateServiceInCatalogue(speciality, actualSpeciality, service, actualService, category, actualCategory)
            console.log(result)

            // console.log(speciality, service, details, 30, 1, dnd, tags, 'Test')
            // const result = await addServiceInCatalogue(speciality, service, actualService, details, 0, 1, dnd, tags, 'Test')
            // console.log(result)
        }
    }
}

async function updateServiceInCatalogue(sp, asp, se, ase, c, ac) {
    console.log(sp, asp, se, ase, c, ac)
    const d = await Catalogue.findServiceDetails(se)
    if (d.length != 0) {
        const s = await Catalogue.findOne({
            speciality: sp
        })
        if (!s) {
            return 'Invalid speciality'
        }
        const i = s.services.findIndex(x => x.service == se)
        if (i == -1) {
            return 'Invalid service'
        }
        if (ase) {
            console.log('updating service')
            s.services[i].service = ase
        }
        if (ac) {
            console.log('updating category')
            s.services[i].category = ac
        }
        await s.save()
        return 'Service updated'
    }
    return 'Invalid service name'
}

async function addServiceInCatalogue(sp, se, as, de, du, si, dn, ta, ca) {
    const s = await Catalogue.findOne({
        speciality: sp
    })
    if (!s) {
        return 'Invalid speciality'
    }
    const d = await Catalogue.findServiceDetails(se)
    console.log(d)
    if (d.length != 0) {
        console.log('Service already exists: ' + se)
        let index = s.services.findIndex(x => x.service == se)
        s.services[index].service = as
        s.services[index].details = de
        s.services[index].duration = du
        s.services[index].sittings = si
        s.services[index].dnd = dn
        s.services[index].tags = ta
        s.services[index].category = ca
    } else {
        console.log('Service not found: ' + se)
        s.services = s.services.concat({
            service: se,
            details: de,
            duration: du,
            sittings: si,
            dnd: dn,
            tags: ta,
            category: ca
        })
        console.log('Service added!')
    }

    // await s.save()
    return 'Service added'
}

loadXlsxFile('./plunes-db/mc.xlsx').then(() => {
    console.log('Done!')
})