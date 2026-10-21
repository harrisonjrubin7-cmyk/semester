from course_studio import CourseStudio
s=CourseStudio('semester-local.sqlite')
s.seed_demo()
try:s.create('demo-a','teacher','sample-course','Sample course','Weekly reflection','Guided')
except __import__('sqlite3').IntegrityError:pass
course=s.read('demo-a','teacher','sample-course')
if course['status']=='draft':s.publish('demo-a','teacher','sample-course',course['version'])
print(s.read('demo-a','student','sample-course'))
