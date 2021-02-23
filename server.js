const express = require('express');
const app = express();
const port = 5000;

app.use(express.static('public'));

app.get('/api', (req, res) => {
    res.send('Uuuuh yeah');
});

app.listen(port, () => {
    console.log(`Example app listening at http://localhost:${port}`);
});
