db.profile.find({}).forEach((u) => {
    if (u.catalogue && u.catalogue.length > 0) {
        u.catalogue.forEach((c) => {
            if (c.procedure_price > 0) {
                print(u.name + '|' + c.name + '|' + c.procedure_price + '|' + c.procedure_variance)
            }
        })
    }
})

db.catalogues.find({}).forEach((c) => {
    c.services.forEach((s) => {
        if (!s.dnd) {
            print(c.speciality + '|' + s.service + '|' + s.category + '|' + s.dnd)
        }
    })
})

db.users.find({}).forEach((u) => {
    if (u.specialities.length != 0) {
        u.specialities.forEach((s) => {
            if (!s.services) {
                return
            }
            s.services.forEach((p) => {
                let a = db.catalogues.findOne({
                    _id: ObjectId(s.specialityId)
                })
                let service = ''
                a.services.forEach((q) => {
                    if (q._id == ObjectId(p.serviceId)) {
                        service = q.service
                    }
                })
                print(u.name + '|' + u.mobileNumber + '|' + a.speciality + '|' + service + '|' + p.price + '|' + p.variance + '|' + p.homeCollection + '|' + p.category)
            })
        })
    }
})