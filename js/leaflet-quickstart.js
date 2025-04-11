/**
 * Takes the value of a date input and formats it in the manner required by the story list.
 *
 * @param {string} dateString
 *   The date input value.
 * @return {string}
 *   The date formatted like "Monday, Mar 3, 2003".
 */
const formatDateForStory = (dateString) =>
    new Date(dateString).toLocaleDateString(undefined, { weekday: "long", year: "numeric", month: "short", day: "numeric" })


  /**
   * Converts a date string into a timestamp that accounts for the current time zone.
   *
   * @param {string} dateString
   *   The value of a date input.
   *
   * @return {number}
   *   A JS-friendly millisecond timestamp.
   */
  const localizedTimestamp = (dateString) =>
    new Date(dateString).getTime() + new Date(dateString).getTimezoneOffset() * 60000