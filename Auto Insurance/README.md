# Automated Auto Insurance Underwriting with MarkLogic and Corticon.js

This project demonstrates a full-stack, end-to-end application for automating the auto insurance underwriting process. It is designed to showcase how the combination of **MarkLogic** as a flexible data hub and **Corticon.js** as a powerful business rules engine can solve a common business challenge: the need for fast, accurate, and transparent insurance quoting.

---

## The Business Requirement: From Manual to Automated Underwriting

In a traditional insurance model, the underwriting process is often slow, manual, and prone to inconsistency. A business analyst might define the rules for pricing and eligibility, but these rules are then translated into code by developers, creating a disconnect between the business logic and its implementation. This can lead to long development cycles, a lack of transparency, and difficulty in adapting to market changes.

This project addresses these challenges by demonstrating a modern, automated approach that delivers:

*   **Speed and Agility:** By externalizing the business logic in Corticon.js, rule changes can be made by business analysts and deployed in minutes, not weeks.
*   **Consistency and Accuracy:** Every application is processed against the exact same set of rules, ensuring consistent and error-free calculations.
*   **Complete Transparency:** The system doesn't just produce a final premium; it generates a detailed, human-readable explanation of how that premium was calculated, providing a full audit trail for compliance and customer service.

---

## The End-to-End Workflow ⚙️

The application is best understood by following the logical flow of implementation, from defining the business logic to presenting the final, explainable results to the user.

1.  **Authoring the Decision Logic:** A business analyst uses Corticon.js Studio 2.3 or higher to define, test, and document all the business rules that govern insurance underwriting. This logic is then bundled into a portable JavaScript function.
2.  **Building the Data Hub Backend:** The MarkLogic backend is set up to handle the entire data lifecycle. This includes ingesting realistic test data, automatically triggering the Corticon.js rules, enriching the data with the results, and exposing it for analysis.
3.  **Creating the Explainability Dashboard:** A React-based frontend provides an interactive dashboard for users to explore the processed policies and get clear, transparent explanations for every automated decision.

We'll explore each of these stages in detail below.

---

## 1\. Authoring the Decision Logic with Corticon.js 🧠

**Purpose:** This is the "design time" phase where the core business intelligence of the system is defined. The goal is to capture complex insurance underwriting policies in a clear, manageable format that is separate from the main application code. This process is handled entirely within **Corticon.js Studio 2.3 or higher**.

### The Authoring Process

*   **Define the Vocabulary:** The first step is to create a data model, or "vocabulary," that defines all the business entities and their attributes. This includes creating objects like `Policy`, `Driver`, and `Vehicle`, and defining their properties (e.g., a `Driver` has an `age` and a `date of birth`). This vocabulary ensures the rules engine understands the structure of the data it will be evaluating.

*   **Author the Rules:** Business rules are authored in **Rulesheets**, which use a simple, spreadsheet-like grid format. This allows complex conditional logic (e.g., *if a driver's age is less than 25 AND they have an "At Fault Auto Accident" incident, THEN add a "Youthful Operator" surcharge*) to be expressed intuitively. Multiple Rulesheets are often used to handle different parts of the logic, such as calculating discounts, applying surcharges, and checking eligibility.

*   **Orchestrate with a Ruleflow:** A **Ruleflow** is a graphical diagram that defines the execution order of different Rulesheets. For example, the Ruleflow might specify that the `Initialization_and_Eligibility` rules run first, followed by `Driver Surcharges`, and then `Policy Level Discounts`. This ensures a logical and predictable decision process.

*   **Test and Validate:** Corticon.js Studio 2.3 or higher includes a powerful testing tool that lets rule authors run their logic against sample data and instantly see the results. This is a critical step that allows business analysts to validate the correctness of their rules *before* they are ever deployed, reducing errors and development cycles.

*   **Deploy as a Decision Service:** Once authoring and testing are complete, the entire project—including the vocabulary, Rulesheets, and Ruleflow—is compiled into a single, self-contained JavaScript file: `decisionServiceBundle.js`. This bundle is a portable **decision service** that can be executed in any JavaScript environment, in this case, by MarkLogic.

---

## 2\. The MarkLogic Data Hub Backend 💾

**Purpose:** This is the "runtime" phase where the MarkLogic backend manages the entire data lifecycle. It's responsible for ingesting data, executing the decision service created in the previous step, and preparing the results for analysis.

### Component 1: Data Ingestion with Mockaroo and Flux

A rules-based system is only as good as the data it's tested against. For this project, we use **Mockaroo** to generate large sets of complex, realistic test data. The schema defines nested JSON structures, custom value lists, and conditional logic to create high-fidelity test cases. This approach is critical for validating that the rules handle a wide variety of scenarios correctly before the system goes live.

Once the JSON data is generated, we use **MarkLogic Flux**, a high-performance command-line tool, to ingest these files directly into the database.

### Component 2: Automated Processing with Triggers

When Flux loads a new application into the `policy-input` collection, a **MarkLogic Trigger** automatically fires. This trigger executes an SJS script which:

1.  Reads the newly ingested insurance application.
2.  Calls the **Corticon.js decision service** (`decisionServiceBundle.js`) to evaluate the data.
3.  Receives a detailed response, including the final premium, a list of messages, and a granular execution trace.
4.  **Enriches** the original document by embedding this response, creating a complete audit trail.
5.  Saves the final, enriched document to the permanent `/data/policy/` collection.

### Component 3: Data Exposure for Analytics with TDE

The enriched JSON documents contain valuable information, but their nested structure can be challenging for traditional BI tools. To solve this, we use **Template Driven Extraction (TDE)**.

A TDE template is a set of instructions that projects JSON data into relational views that can be queried with standard SQL. It does this without duplicating the data, acting as a "lens" on top of the native JSON. This allows data analysts and BI tools to easily perform **decision analytics**, querying the outcomes of the rule executions to identify trends, validate logic, and measure business impact.

---

## 3\. The Explainability Dashboard (Frontend) 🖥️

**Purpose:** This is the "consumption" phase, where the results of the automated decisions are made transparent and understandable to a human user.

The frontend is a modern **React** application that communicates with the MarkLogic backend via a lightweight **Node.js** proxy. It provides a simple but powerful interface for exploring the decisions.

### Key Features for Explainability

*   **Policy Details:** The main view provides a complete summary of the policy *after* all rules have been applied, including the final net premium and a breakdown of coverages, drivers, and vehicles.

*   **Decision Log:** This tab displays the human-readable messages generated by the Corticon decision service. It provides a clear, step-by-step narrative of the decision process, perfect for business users or customer service representatives who need to explain a calculation.

*   **Execution Trace:** For deep dives and auditing, this tab visualizes the granular `Metrics` data. It shows every single attribute change (with before and after values), every entity that was created, and every association that was made during the rule execution. This provides an unbreakable audit trail and is an invaluable tool for rule authors and developers to debug and validate the system's behavior.

---

## 🚀 How to Run This Demo

To get this demo up and running, please follow the step-by-step instructions in the README files for the backend and frontend components:

1.  **[Set up the MarkLogic Backend](./mlCorticonAutoInsurance/README.md)**
2.  **[Run the React Frontend](./insurance-chatbot/ui/README.md)**
