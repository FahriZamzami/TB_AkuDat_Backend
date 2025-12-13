const sequelize = require("./db");
const Visualization = require("./Visualization");

sequelize.sync({ alter: true })
    .then(() => console.log("Database & tables synced"))
    .catch(err => console.error(err));

module.exports = {
    sequelize,
    Visualization,
};