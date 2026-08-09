# Database Design

## Table 1: Identity
* **Primary Key:** UserID (or Unique_ID)
* **Columns:** Name, Password (Hash), Category, Student Roll Number, Class, Teacher Subject, Classes Managed, Account Status, False Complaint Count, Leaderboard Score, Registration Date

## Table 2: Issues
* **Primary Key:** IssueID (Complaint_ID)
* **Columns:** Complaint Text, Anonymous Student ID, Target Teacher, Verification Status, Verifier Teacher ID, Student Upvotes, Teacher Upvotes, Student Downvotes, Teacher Downvotes, Weighted Score, Status, AI Category, Creation Time, Last Updated

## Table 3: Leaderboard
* **Primary Key:** TeacherID
* **Columns:** Teacher Name, Overall Rating, Total Ratings, Positive Score, Negative Score, Verified Complaints, Rejected Complaints, Penalty Points, Rank
