Feature: The pages of the demo and the links between them
  The demo of the create tool, built with the Node adapter: a home page with a counter, an about page
  built without client-side code, and a word game. Built with `bash cmd-svelte-project.sh skapp
  --install`, at the address of the app.

  @critical
  Scenario: A link stays in the app, is announced, and moves the current page
    Given I am on the homepage
    And the app has taken over the page
    When I follow the "Sverdle" link in the app
    Then the last navigation should have stayed in the app
    And the navigation should be announced as "Sverdle"
    And the "Sverdle" link should mark the current page
    And I should be at the top of the page for the keyboard
    When I go back in the app
    Then the last navigation should have stayed in the app
    And the navigation should be announced as "Home"
    And the "Home" link should mark the current page

  # The counter of the home page moves its digits with a spring: the steps of webship-js do not wait for its frames,
  # the tag does, after each step.
  @settle-after-steps
  Scenario: A count that moves to its new value
    Given I am on the homepage
    When I press "Increase the counter by one" by attr
    Then I should see "1" in the ".counter-viewport strong:not([aria-hidden])" element

  Scenario: A link the pointer rested on is fetched ahead, and still ends inside the app
    Given I am on the homepage
    When I point at the "About" link
    And I follow the "About" link in the app
    Then the last navigation should have stayed in the app
    And the navigation should be announced as "About"
    And I should see "About this app"

  Scenario: A page built without client-side code, loaded directly, loads whole pages
    Given I am on "/about"
    Then the page should have no client-side code
    When I follow the "Sverdle" link in the app
    Then the last navigation should have loaded a whole page
    And the "Sverdle" link should mark the current page

  Scenario: An address the app does not know shows its error page
    Given I am on "/no-such-page"
    Then the page should show the 404 error "Not Found"
    And the response status code should be 404
