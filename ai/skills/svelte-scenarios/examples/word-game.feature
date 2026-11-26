Feature: The word game, one form of buttons
  The demo's word game: every key of its keyboard is a button of one form, and a guess is its action.
  With JavaScript the app takes the keys in the page and sends a guess inside the page. Built with
  `bash cmd-svelte-project.sh skapp --install`, at the address of the app.

  Background:
    Given I am on "/sverdle"

  @critical
  Scenario: A word the game knows is accepted, and its row says how close it was
    When I submit the form with the "a" button
    And I submit the form with the "b" button
    And I submit the form with the "o" button
    And I submit the form with the "u" button
    And I submit the form with the "t" button
    And I submit the form with the "enter" button
    Then the form should have been sent without loading the page
    And the app should have accepted the form
    And I should see text matching "\((correct|present|absent)\)"

  Scenario: A word the game does not know is refused
    When I submit the form with the "z" button
    And I submit the form with the "z" button
    And I submit the form with the "z" button
    And I submit the form with the "z" button
    And I submit the form with the "z" button
    And I submit the form with the "enter" button
    Then the app should have refused the form
