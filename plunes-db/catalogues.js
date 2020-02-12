const fs = require('fs')

const data = JSON.parse(fs.readFileSync('catalogues.json'))

data.forEach(s => {
    s.services.forEach(p => {
        if (p.details) {
            p.details = p.details.replace('\n', '')
        }
        p.dnd = p.dnd.replace('\n', '')
        console.log(s.speciality + '||' + p.service + '||' + p.details + '||' + p.dnd + '||' + p.tags)
    })
})