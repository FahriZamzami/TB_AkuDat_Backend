// backend/src/controllers/visualizationController.js

const { Visualization } = require("../../models");
const { spawn } = require("child_process");
const path = require("path");
const fs = require("fs");

// Helper function to run Python script
function runPythonScript(command, args) {
return new Promise((resolve, reject) => {
    const pythonPath =
    process.platform === "win32"
        ? path.join(__dirname, "../../python/venv/Scripts/python.exe")
        : path.join(__dirname, "../../python/venv/bin/python");

    const scriptPath = path.join(__dirname, "../../python/kmeans_clustering.py");

    const python = spawn(pythonPath, [scriptPath, command, ...args]);

    let dataString = "";
    let errorString = "";

    python.stdout.on("data", (data) => {
    dataString += data.toString();
    });

    python.stderr.on("data", (data) => {
    errorString += data.toString();
    });

    python.on("close", (code) => {
    if (code !== 0) {
        reject(new Error(errorString || "Python script failed"));
    } else {
        try {
        const result = JSON.parse(dataString);
        resolve(result);
        } catch (e) {
        reject(new Error("Failed to parse Python output: " + dataString));
        }
    }
    });
});
}

// Get all visualizations
exports.getAllVisualizations = async (req, res) => {
try {
    const visualizations = await Visualization.findAll({
    order: [["createdAt", "DESC"]],
    });
    res.json(visualizations);
} catch (error) {
    res.status(500).json({ error: error.message });
}
};

// Get single visualization
exports.getVisualizationById = async (req, res) => {
    try {
        const visualization = await Visualization.findByPk(req.params.id);

        if (!visualization) {
        return res.status(404).json({ error: "Visualization not found" });
        }

        res.json({
        id: visualization.id,
        name: visualization.name,
        datasetFile: visualization.datasetFile,
        keyColumn: visualization.keyColumn, // ✅ DIKIRIM
        columnX: visualization.columnX,
        columnY: visualization.columnY,
        numClusters: visualization.numClusters,
        silhouetteScore: visualization.silhouetteScore,
        });

    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

// Upload dataset and get comprehensive data info
exports.uploadDataset = async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ error: "No file uploaded" });
        }

        const { encoding = "utf-8", delimiter = "," } = req.body;
        const filePath = req.file.path;

        const result = await runPythonScript("get_data_info", [
            filePath,
            encoding,
            delimiter,
        ]);

        if (!result.success) {
            fs.unlinkSync(filePath);
            return res.status(400).json({ error: result.error });
        }

        // Ambil seluruh data untuk ditampilkan
        // result.rows diasumsikan array of object [{col1: val, col2: val, ...}, ...]

        res.json({
            filename: req.file.filename,
            columns: result.columns,
            numeric_columns: result.numeric_columns,
            null_info: result.null_info,
            has_nulls: result.has_nulls,
            has_duplicates: result.has_duplicates,
            num_rows: result.num_rows,
            num_duplicates: result.num_duplicates
        });

    } catch (error) {
        if (req.file) fs.unlinkSync(req.file.path);
        res.status(500).json({ error: error.message });
    }
};

// Clean data based on user's choices
exports.cleanData = async (req, res) => {
    try {
        const { filename, cleaningOptions, encoding = "utf-8", delimiter = "," } = req.body;

        const filePath = path.join(__dirname, "../../uploads", filename);

        if (!fs.existsSync(filePath)) {
            return res.status(404).json({ error: "File not found" });
        }

        const result = await runPythonScript("clean_data", [
            filePath,
            JSON.stringify(cleaningOptions),
            encoding,
            delimiter,
        ]);

        if (!result.success) {
            return res.status(400).json({ error: result.error });
        }

        // Ambil seluruh data setelah clean
        const sample_rows = result.rows || []; 

        res.json({
            success: true,
            cleaned_filename: result.cleaned_filename,
            columns: result.columns,
            numeric_columns: result.numeric_columns || [],
            rows_removed: result.rows_removed,
            columns_dropped: result.columns_dropped || [],
            sample_rows: result.rows
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

// Calculate elbow
exports.calculateElbow = async (req, res) => {
try {
    const { filename, columnX, columnY, encoding = "utf-8", delimiter = "," } =
    req.body;
    const filePath = path.join(__dirname, "../../uploads", filename);

    if (!fs.existsSync(filePath)) {
    return res.status(404).json({ error: "File not found" });
    }

    const result = await runPythonScript("elbow", [
    filePath,
    columnX,
    columnY,
    encoding,
    delimiter,
    ]);

    if (!result.success) {
    return res.status(400).json({ error: result.error });
    }

    res.json(result);
} catch (error) {
    res.status(500).json({ error: error.message });
}
};

// Process clustering
exports.processClustering = async (req, res) => {
    try {
        const {
        name,
        originalFilename,
        cleanedFilename, // ⬅️ boleh null
        keyColumn,
        columnX,
        columnY,
        numClusters,
        encoding = "utf-8",
        delimiter = ",",
        } = req.body;

        if (!name || !keyColumn || !columnX || !columnY) {
        return res.status(400).json({ error: "Data tidak lengkap" });
        }

        const datasetToUse = cleanedFilename || originalFilename;
        const filePath = path.join(__dirname, "../../uploads", datasetToUse);

        if (!fs.existsSync(filePath)) {
        return res.status(404).json({ error: "Dataset file not found" });
        }

        const result = await runPythonScript("cluster", [
        filePath,
        keyColumn,
        columnX,
        columnY,
        numClusters.toString(),
        encoding,
        delimiter,
        ]);

        if (!result.success) {
        return res.status(400).json({ error: result.error });
        }

        // ✅ CREATE SEKALI SAJA
        const visualization = await Visualization.create({
        name,
        datasetFile: originalFilename,
        datasetClean: cleanedFilename || null,
        keyColumn,
        columnX,
        columnY,
        numClusters,
        encoding,
        delimiter,
        silhouetteScore: result.silhouette_score,
        columnsUsed: JSON.stringify(result.columns_used),
        // centroids: JSON.stringify(result.centroids),
        // boxplotData: JSON.stringify(result.boxplot_data),
        });

        res.json({
        visualization,
        clusteringResult: result,
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

// Get clustering results for a visualization
exports.getClusteringResults = async (req, res) => {
    try {
        const visualization = await Visualization.findByPk(req.params.id);

        if (!visualization) {
        return res.status(404).json({ error: "Visualization not found" });
        }

        const filePath = path.join(
        __dirname,
        "../../uploads",
        visualization.datasetClean
        );

        if (!fs.existsSync(filePath)) {
        return res.status(404).json({ error: "Dataset file not found" });
        }

        const result = await runPythonScript("cluster", [
        filePath,
        visualization.keyColumn, // ⚠️ simpan di DB
        visualization.columnX,
        visualization.columnY,
        visualization.numClusters.toString(),
        visualization.encoding,
        visualization.delimiter,
        ]);

        if (!result.success) {
        return res.status(400).json({ error: result.error });
        }

        res.json({
        visualization: {
            id: visualization.id,
            name: visualization.name,
            datasetFile: visualization.datasetFile,
            numClusters: visualization.numClusters,
            silhouetteScore: visualization.silhouetteScore,
            columnX: visualization.columnX,
            columnY: visualization.columnY,
            keyColumn: visualization.keyColumn
        },
        clusteringResult: {
            scatter_data: result.data_points,
            centroids: result.centroids,
            boxplot_data: result.boxplot_data,
            cluster_detail: result.cluster_detail
        },
        });

    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

// Delete visualization
exports.deleteVisualization = async (req, res) => {
    try {
        const visualization = await Visualization.findByPk(req.params.id);

        if (!visualization) {
        return res.status(404).json({ error: "Visualization not found" });
        }

        const uploadsDir = path.join(__dirname, "../../uploads");

        const filesToDelete = [
        visualization.datasetFile,
        visualization.datasetClean,
        ].filter(Boolean);

        filesToDelete.forEach((file) => {
        const fullPath = path.join(uploadsDir, file);
        if (fs.existsSync(fullPath)) {
            fs.unlinkSync(fullPath);
        }
        });

        await visualization.destroy();

        res.json({
        message: "Visualization deleted successfully",
        deletedFiles: filesToDelete,
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};