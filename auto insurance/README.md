# Automated Auto Insurance Underwriting with MarkLogic and Corticon.js

This project demonstrates a full-stack, end-to-end application for automating auto insurance underwriting. It showcases how to combine the power of **MarkLogic** as a data hub, **Corticon.js** as a business rules engine, and a **React** frontend to create a system that is not only automated but also fully transparent and explainable.

-----

## The End-to-End Workflow ⚙️

The application is best understood by following the logical flow of implementation, from defining the business logic to presenting the final, explainable results to the user.

1.  **Authoring the Decision Logic:** First, a business analyst or rule author uses Corticon.js Studio to define, test, and document all the business rules that govern insurance underwriting. This logic is then bundled into a portable JavaScript function.
2.  **Building the Data Hub Backend:** Next, the MarkLogic backend is set up to handle the entire data lifecycle. This includes ingesting realistic test data, automatically triggering the Corticon.js rules, enriching the data with the results, and exposing it for SQL-based analytics.
3.  **Creating the Explainability Dashboard:** Finally, a React-based frontend provides an interactive dashboard for users to explore the processed policies and get clear, transparent explanations for every automated decision.

We'll explore each of these stages in detail below.

-----

## 1\. Authoring the Decision Logic with Corticon.js 🧠

**Purpose:** This is the "design time" phase where the core business intelligence of the system is defined. The goal is to capture complex insurance underwriting policies in a clear, manageable format that is separate from the main application code.

This process is handled entirely within the **Corticon.js Studio**.

### The Authoring Process

  * **Define the Vocabulary:** The first step is to create a data model, or "vocabulary," that defines all the business entities and their attributes. This includes creating objects like `Policy`, `Driver`, and `Vehicle`, and defining their properties (e.g., a `Driver` has an `age` and a `date of birth`). This vocabulary ensures the rules engine understands the structure of the data it will be evaluating.

  * **Author the Rules:** Business rules are authored in **Rulesheets**, which use a simple, spreadsheet-like grid format. This allows complex conditional logic (e.g., *if a driver's age is less than 25 AND they have an "At Fault Auto Accident" incident, THEN add a "Youthful Operator" surcharge*) to be expressed intuitively. Multiple Rulesheets are often used to handle different parts of the logic, such as calculating discounts, applying surcharges, and checking eligibility.

  * **Orchestrate with a Ruleflow:** A **Ruleflow** is a graphical diagram that defines the execution order of different Rulesheets. For example, the Ruleflow might specify that the `Initialization_and_Eligibility` rules run first, followed by `Driver Surcharges`, and then `Policy Level Discounts`. This ensures a logical and predictable decision process.

  * **Test and Validate:** Corticon Studio includes a powerful testing tool that lets rule authors run their logic against sample data and instantly see the results. This is a critical step that allows business analysts to validate the correctness of their rules *before* they are ever deployed, reducing errors and development cycles.

  * **Deploy as a Decision Service:** Once authoring and testing are complete, the entire project—including the vocabulary, Rulesheets, and Ruleflow—is compiled into a single, self-contained JavaScript file: `decisionServiceBundle.js`. This bundle is a portable **decision service** that can be executed in any JavaScript environment, in this case, by MarkLogic.

-----

## 2\. The MarkLogic Data Hub Backend 💾

**Purpose:** This is the "runtime" phase where the MarkLogic backend manages the entire data lifecycle. It's responsible for ingesting data, executing the decision service created in the previous step, and preparing the results for analysis.

### Component 1: Data Ingestion with Mockaroo and Flux

A rules-based system is only as good as the data it's tested against. For this project, we use **Mockaroo** to generate large sets of complex, realistic test data. The schema defines nested JSON structures, custom value lists, and conditional logic to create high-fidelity test cases.

This approach is critical for validating that the rules handle a wide variety of scenarios correctly before the system goes live.

```json
// Snippet from the Mockaroo data generation schema
{
  "name": "drivers.gpa",
  "type": "Formula",
  "value": "if fullTimeStudent == true then format(random(180, 400) / 100.0, 2) else nil end"
},
{
  "name": "drivers.incidents.incidentType",
  "type": "Custom List",
  "values": [ "At Fault Auto Accident", "OUI Conviction", ... ],
  "selectionStyle": "weighted"
}
```

Once the JSON data is generated, we use **MarkLogic Flux**, a high-performance command-line tool, to ingest these files directly into the database.

### Component 2: Automated Processing with Triggers

When Flux loads a new application into the `policy-input` collection, a **MarkLogic Trigger** automatically fires. This trigger executes the `autoInsuranceTrigger.sjs` script, which:

1.  Reads the newly ingested insurance application.
2.  Calls the **Corticon.js decision service** (`decisionServiceBundle.js`) to evaluate the data.
3.  Receives a detailed response, including the final premium, a list of messages, and a granular execution trace.
4.  **Enriches** the original document by embedding this response, creating a complete audit trail.
5.  Saves the final, enriched document to the permanent `/data/policy/` collection.

### Component 3: Data Exposure for Analytics with TDE

The enriched JSON documents contain valuable information, but their nested structure can be challenging for traditional BI tools. To solve this, we use **Template Driven Extraction (TDE)**.

A TDE template is a set of instructions that projects JSON data into relational views that can be queried with standard SQL. It does this without duplicating the data, acting as a "lens" on top of the native JSON. This allows data analysts and BI tools to easily perform **decision analytics**, querying the outcomes of the rule executions to identify trends, validate logic, and measure business impact.

-----

## 3\. The Explainability Dashboard (Frontend) 🖥️

**Purpose:** This is the "consumption" phase, where the results of the automated decisions are made transparent and understandable to a human user.

The frontend is a modern **React** application that communicates with the MarkLogic backend via a lightweight **Node.js** proxy. It provides a simple but powerful interface for exploring the decisions.

### Key Features for Explainability

  * **Policy Details:** The main view provides a complete summary of the policy *after* all rules have been applied, including the final net premium and a breakdown of coverages, drivers, and vehicles.

  * **Decision Log:** This tab displays the human-readable messages generated by the Corticon decision service. It provides a clear, step-by-step narrative of the decision process, perfect for business users or customer service representatives who need to explain a calculation.

  * **Execution Trace:** For deep dives and auditing, this tab visualizes the granular `Metrics` data. It shows every single attribute change (with before and after values), every entity that was created, and every association that was made during the rule execution. This provides an unbreakable audit trail and is an invaluable tool for rule authors and developers to debug and validate the system's behavior.