// backend/src/models/Visualization.js

const { DataTypes } = require("sequelize");
const sequelize = require("./db");

const Visualization = sequelize.define(
"Visualization",
{
    id: {
    type: DataTypes.INTEGER,
    autoIncrement: true,
    primaryKey: true,
    },

    name: {
    type: DataTypes.STRING,
    allowNull: false,
    },

    // ===== DATASET FILES =====
    datasetFile: {
    type: DataTypes.STRING,
    allowNull: false,
    },

    datasetClean: {
    type: DataTypes.STRING,
    allowNull: true,
    },

    // ===== CLUSTER CONFIG =====
    numClusters: {
    type: DataTypes.INTEGER,
    allowNull: false,
    },

    keyColumn: {
    type: DataTypes.STRING,
    allowNull: true,
    },

    columnX: {
    type: DataTypes.STRING,
    allowNull: false,
    },

    columnY: {
    type: DataTypes.STRING,
    allowNull: false,
    },

    // ===== CSV SETTINGS =====
    encoding: {
    type: DataTypes.STRING,
    defaultValue: "utf-8",
    },

    delimiter: {
    type: DataTypes.STRING,
    defaultValue: ",",
    },

    // ===== METRICS =====
    silhouetteScore: {
    type: DataTypes.FLOAT,
    allowNull: true,
    },

    columnsUsed: {
    type: DataTypes.TEXT,
    allowNull: true,
    },

    // // ===== OPTIONAL (kalau nanti mau dipakai) =====
    // centroids: {
    // type: DataTypes.TEXT,
    // allowNull: true,
    // },

    // boxplotData: {
    // type: DataTypes.TEXT,
    // allowNull: true,
    // },
},
{
    timestamps: true, // createdAt & updatedAt
    tableName: "visualizations",
}
);

module.exports = Visualization;