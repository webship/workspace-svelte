Feature: The minimal template
  The one page of the create tool's minimal template, built with the Node adapter. Built with
  `bash cmd-svelte-project.sh skmin --template minimal --install`, at the address of the app.

  @critical
  Scenario: The page is taken over by the app
    Given I am on the homepage
    Then the app should have taken over the page
    And I should see "Welcome to SvelteKit"
    And I should see "to read the documentation"

  Scenario: An address the app does not know shows its error page
    Given I am on "/no-such-page"
    Then the page should show the 404 error "Not Found"
    And the response status code should be 404
