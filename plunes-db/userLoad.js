const fs = require('fs')

const catalogues = JSON.parse(fs.readFileSync(`./catalogues.json`))
const profile = JSON.parse(fs.readFileSync(`./profile.json`))
const businessHours = JSON.parse(fs.readFileSync(`./business_hours.json`))

// console.log(catalogues.length)
// console.log(profile.length)
// console.log(businessHours.length)

profile.forEach(function(u) {
    console.log(u.name)
    const user = {
        name: u.name,
        email: u.email,
        mobileNumber: u.phone_number,
        verifiedUser: true,
        geoLocation: {
            latitude: u.geolocation.coordinates[1],
            longitude: u.geolocation.coordinates[0]
        },
        gender: u.gender.substr(0, 1),

    }
})