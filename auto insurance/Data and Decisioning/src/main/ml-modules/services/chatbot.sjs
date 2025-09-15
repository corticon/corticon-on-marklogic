'use strict';

function post(context, params, input) {
  const question = input.toObject().query;
  const searchResults = cts.search(cts.wordQuery(question));

  const response = {
    citations: [],
    output: `I found ${searchResults.length} policies related to your question.`
  };

  for (const result of searchResults) {
    response.citations.push({
      citationId: result.uri,
      citationLabel: result.uri
    });
  }

  return response;
}

exports.POST = post;