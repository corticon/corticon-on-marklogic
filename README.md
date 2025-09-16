# Corticon.js on MarkLogic: Demonstration Projects

This repository contains a collection of projects demonstrating the integration of **Corticon.js** with **MarkLogic Server** for various use cases. Each project is self-contained and showcases a different aspect of how these two technologies can be combined to build powerful, data-driven applications with automated decision-making.

---

## Projects

This repository includes the following demonstration projects:

### 1. [Auto Insurance Underwriting](./Auto%20Insurance/README.md)

This project demonstrates a full-stack, end-to-end application for automating auto insurance underwriting. It showcases how to combine the power of MarkLogic as a data hub, Corticon.js as a business rules engine, and a React frontend to create a system that is not only automated but also fully transparent and explainable.

### 2. [Medicaid Eligibility](./Medicaid%20Eligibility/README.md)

This project demonstrates a powerful, modern architecture for automating Medicaid eligibility decisions. It provides a high-fidelity simulation of a real-world Medicaid eligibility system, grounded in both realistic business rules and statistically modeled test data.

### 3. [Trade Data Settlement](./Trade%20Data%20Settlement/README.md)

This project demonstrates how to run Corticon.js decision services directly inside a MarkLogic database using ml-gradle for deployment and environment management. It includes preconfigured roles, users, triggers, and modules for integrating Corticon.js rule execution into a MarkLogic-based data pipeline.

---

## General Prerequisites

While each project has its own specific prerequisites, the following are common to all projects in this repository:

*   **MarkLogic 10+**
*   **Java 11+** and **Gradle**
*   **Corticon.js Studio** (to author and bundle the business rules)

---

## How to Use

Each project directory contains a detailed `README.md` file with specific instructions on how to configure, deploy, and run the demonstration. Please refer to the individual project READMEs for more information.
