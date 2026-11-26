Feature: The app answers, moves between its pages and takes its form
  As the owner of the app
  I want its pages to open, its links to stay in the app and its form to answer
  So that a build that came out broken is caught before anything else is tested

  # Placed by the workspace's testing setup for the demo of the create tool, as a starting point: it is yours to
  # change. The steps wait for the app to take each page over, follow a navigation inside the app to its end, and send
  # the form the way the app does.

  @critical
  Scenario: The home page is taken over by the app
    Given I am on the homepage
    Then the app should have taken over the page
    And I should see "try editing"

  @critical
  Scenario: A link stays in the app, and the new page is announced
    Given I am on the homepage
    When I follow the "Sverdle" link in the app
    Then the last navigation should have stayed in the app
    And the navigation should be announced as "Sverdle"
    And the "Sverdle" link should mark the current page

  @critical
  Scenario: A word the game knows is accepted
    Given I am on "/sverdle"
    When I submit the form with the "a" button
    And I submit the form with the "b" button
    And I submit the form with the "o" button
    And I submit the form with the "u" button
    And I submit the form with the "t" button
    And I submit the form with the "enter" button
    Then the app should have accepted the form

  Scenario: A word the game does not know is refused
    Given I am on "/sverdle"
    When I submit the form with the "z" button
    And I submit the form with the "z" button
    And I submit the form with the "z" button
    And I submit the form with the "z" button
    And I submit the form with the "z" button
    And I submit the form with the "enter" button
    Then the app should have refused the form

  Scenario: An address the app does not know shows its error page
    Given I am on "/no-such-page"
    Then the page should show the 404 error "Not Found"
