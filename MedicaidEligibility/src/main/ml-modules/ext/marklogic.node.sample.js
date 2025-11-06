/*
This is a sample for invoking Corticon.js decision service rules from a node application.
It is provided for general information purposes.  The recommended way to integrate Corticon.js with
MarkLogic is to use a trigger (See marklogic.trigger.sample.js for such an example).
Corticon.js can also be used from DataHub as one of the step to execute.
In each case, the same decision service file (decisionServiceBundle.js) can be used without any changes.

Some references:
See https://www.progress.com/corticon-js and https://www.progress.com/corticon/corticon-learning-center
for more information about Corticon.js.

Read this blog for the benefits of integrating Corticon.js with MarkLogic:
https://www.progress.com/blogs/no-code-business-logic-development-for-marklogic-database
*/

/*
How does this sample work?
This sample reads the request to pass to the decision service from the file system and writes its results to the file
system as well.  You can adapt this sample to use other mechanisms, for example, reading the request data from a
MarkLogic database and writing the results of the decision service to a separate database.
In all these cases, the data in and the data out is in JSON format.

How to use this sample:
Create a file called payload.json containing the decision service request.
Execute the sample using Node.js
The decision service results are written to result.json
*/

// We import filesystem as we will read the payload from a file and write the results to a file
const fs = require('fs');

// We import the bundle you created with the Corticon command "Package Rules for Deployment" (on Project menu)
const decisionService = require('./decisionServiceBundle');

// Execute the decision service for this payload and place results in file
runDecisionService('payload.json', 'result.json');

async function runDecisionService(payloadFileName,resultFileName) {
    const payload = readPayload(payloadFileName);

    // This is where you specify various configuration attributes
    // Note: Errors are always logged no matter what configuration you specify
    // logLevel: 0: only error gets logged (default), 1: debugging info gets logged
    // logIsOn: when false, do not log. True by default, you can override dynamically to log data only for certain calls (for example by checking for a specific payload)
    // logPerfData: when true, will log performance data
    // logFunction: Used to implement your own logger.  When defined this function is called with a string message to log and an error level.
    const configuration = { logLevel: 0 };
    //const configuration = { logLevel: 1, logIsOn: isLogOnForThisPayload(body), logFunction: myLogger};

	/*
	*******************************************************
	Configuration Properties for Rule Messages
	*******************************************************
	/*const configuration = {
		logLevel: 0,
		ruleMessages: {
			logRuleMessages: false, // If true the rule messages will be logged to console
			executionProperties: {
						restrictInfoRuleMessages: true, // If true Restricts Info Rule Messages
						restrictWarningRuleMessages: true, // If true Restricts Warning Rule Messages
						restrictViolationRuleMessages: true, // If true Restricts Violation Rule Messages
						restrictResponseToRuleMessagesOnly: true, // If true the response returned has only rule messages
			},
		},

	};*/

    // Here we invoke the rules
    const result = decisionService.execute(payload, configuration);
    /*
    // Here is how you can check if there were any errors executing the rules.
    // (if you needed to do some additional processing before sending the response back to the client)
    	if(result.corticon.status === 'error') {
			// you can access a description of the error like this:
			result.corticon.description
		}
    */

    // Write the result to a file.
    let data = JSON.stringify(result, null, 2);
    fs.writeFileSync(resultFileName, data);
}

function readPayload (fileName) {
    // Read the payload from the file system
    const rawData = fs.readFileSync(fileName);
    return JSON.parse(rawData);
}


/*
 This is a sample of the function where you can override dynamically when to log data.
 It is useful for tracing only certain calls (for example by checking for a specific payload)
 This function is optional.  When you pass a simple configuration without the logIsOn property you don't need
 to define this function.
 */
function isLogOnForThisPayload(payload) {
    let flag;
    try {
        if ( payload.Objects[0]['int1'] === 1 )
            flag = true;
        else
            flag = false;
    }
    catch ( e ) {
        console.log (`Error in isLogOnForThisPayload: ${e}\n`);
        flag = true;
    }

    console.log(`isLogOnForThisPayload: ${flag}\n`);
    return flag;
}

/*
Here is a sample custom logger.  Adapt to your own need.
logLevel:
    1: log error
    2: log debug data
 */
function myLogger(msg, logLevel) {
    if ( logLevel === 0 )
        console.error(`**CUSTOM ERROR LOGGER: ${msg}`);
    else
        console.info(`**CUSTOM DEBUG LOGGER: ${msg}`);
}
