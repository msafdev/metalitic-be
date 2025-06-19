require("dotenv").config({ path: "./.env" });
const app = require("./src/app");

const PORT = process.env.PORT;
// console.log("PORT ", PORT)

app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
