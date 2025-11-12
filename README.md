# Corticon.js on MarkLogic: Demonstration Projects

This repository contains a collection of projects demonstrating the integration of **Corticon.js** with **MarkLogic Server**. Each project is a self-contained, end-to-end application showcasing how these two powerful technologies can be combined to solve complex, real-world business problems through automated, data-driven decision-making.

The goal of these demonstrations is to provide clear, practical examples for users who are familiar with the concepts of MarkLogic and Corticon.js and have access to the necessary software, but are looking for guidance on how to build a complete solution from the ground up.

---

## The Business Value

In today's data-driven world, organizations need to make faster, more consistent, and more transparent decisions. However, business logic is often buried in application code, making it difficult to change, and data is frequently siloed, making it impossible to get a holistic view.

This repository demonstrates a modern architectural pattern that addresses these challenges by:

*   **Externalizing Business Rules:** Using Corticon.js to separate business logic from application code. This empowers business analysts to manage and evolve rules without requiring developer intervention, leading to greater agility and reduced costs.
*   **Centralizing and Enriching Data:** Using MarkLogic as a multi-model data hub to ingest, harmonize, and govern data from various sources. This creates a single source of truth and enables real-time enrichment of data with decision outcomes.
*   **Providing Full Explainability:** By combining the decision-making power of Corticon.js with the data management capabilities of MarkLogic, these projects deliver not just automated decisions, but also a complete, auditable trail of *how* and *why* each decision was made.

---

## Projects

This repository includes the following demonstration projects:

### 1. [Auto Insurance Underwriting](./Auto%20Insurance/README.md)

**Business Scenario:** An insurance company wants to automate its underwriting process to provide instant, accurate quotes to potential customers. They need a system that can handle complex eligibility rules, pricing calculations, and discount logic, while also providing a clear explanation of the final premium to both customers and internal staff.

This project demonstrates a full-stack application that uses Corticon.js to model the underwriting rules and MarkLogic to manage the policy data and decision outcomes. A React-based frontend provides an "explainability dashboard" for exploring the results.

### 2. [Medicaid Eligibility](./MedicaidEligibility/README.md)

**Business Scenario:** A state government agency is responsible for determining citizen eligibility for Medicaid and CHIP benefits. The rules are complex, vary by state, and are subject to frequent change based on federal and state legislation. The agency needs a system that can automate these complex eligibility determinations accurately and provide a clear audit trail for compliance purposes.

This project provides a high-fidelity simulation of a real-world Medicaid eligibility system. It uses a sophisticated set of Corticon.js rules, modeled on current federal and state policies, and statistically realistic test data to demonstrate how this architecture can handle the complexities of public sector decision-making.

### 3. [Trade Data Settlement](./Trade%20Data%20Settlement/README.md)

**Business Scenario:** A financial services firm needs to validate and enrich incoming trade data in real-time. As trades are processed, they must be checked against a variety of rules for compliance, risk, and settlement procedures. The firm needs a high-performance system that can apply these rules as the data is ingested, without slowing down the data pipeline.

This project demonstrates a lean, powerful backend solution for real-time data enrichment. It shows how to deploy a Corticon.js decision service directly within MarkLogic and trigger it automatically as new data arrives, providing a seamless and efficient way to embed decision-making into a data pipeline.

---

## General Prerequisites

While each project has its own specific setup instructions, the following are common to all projects in this repository:

*   **MarkLogic 12+**
*   **Java 11+** and **Gradle**
*   **Corticon.js Studio 2.3 or higher** (to author and bundle the business rules)
*   For frontends: **Node.js (LTS)**

---
