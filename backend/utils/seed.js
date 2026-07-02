import dotenv from 'dotenv';
import mongoose from 'mongoose';
import User from '../models/User.js';
import AcademicYear from '../models/AcademicYear.js';
import Semester from '../models/Semester.js';
import Department from '../models/Department.js';
import Section from '../models/Section.js';
import Batch from '../models/Batch.js';
import Subject from '../models/Subject.js';
import Trainer from '../models/Trainer.js';
import Venue from '../models/Venue.js';
import Student from '../models/Student.js';
import Schedule from '../models/Schedule.js';
import Leave from '../models/Leave.js';
import Attendance from '../models/Attendance.js';

import {
  combineDateAndTime,
  normalizeDate,
} from './scheduleHelpers.js';

dotenv.config();

const seed = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Connected to MongoDB for seeding...');

    // Clear existing data
    await Promise.all([
      User.deleteMany(),
      AcademicYear.deleteMany(),
      Semester.deleteMany(),
      Department.deleteMany(),
      Section.deleteMany(),
      Batch.deleteMany(),
      Subject.deleteMany(),
      Trainer.deleteMany(),
      Venue.deleteMany(),
      Student.deleteMany(),
      Schedule.deleteMany(),
      Leave.deleteMany(),
      Attendance.deleteMany(),
    ]);

    // Academic structure
    const academicYear = await AcademicYear.create({
      name: '2025-2026',
      startDate: new Date('2025-07-01'),
      endDate: new Date('2026-06-30'),
      isActive: true,
    });

    const semesters = await Semester.insertMany([
      { name: 'Semester 1', number: 1, academicYear: academicYear._id, isActive: true },
      { name: 'Semester 2', number: 2, academicYear: academicYear._id },
      { name: 'Semester 3', number: 3, academicYear: academicYear._id },
      { name: 'Semester 4', number: 4, academicYear: academicYear._id },
    ]);

    const departments = await Department.insertMany([
      { name: 'Computer Science', code: 'CSE' },
      { name: 'Electronics', code: 'ECE' },
      { name: 'Mechanical', code: 'MECH' },
    ]);

    const sections = await Section.insertMany([
      { name: 'A', department: departments[0]._id },
      { name: 'B', department: departments[0]._id },
      { name: 'A', department: departments[1]._id },
    ]);

    const batches = await Batch.insertMany([
      { name: 'CSE-A-2025', section: sections[0]._id, semester: semesters[0]._id, studentCount: 60 },
      { name: 'CSE-B-2025', section: sections[1]._id, semester: semesters[0]._id, studentCount: 55 },
    ]);

    const venues = await Venue.insertMany([
      { name: 'Room 101', building: 'Main Block', floor: '1', capacity: 60, type: 'classroom' },
      { name: 'Lab 201', building: 'CS Block', floor: '2', capacity: 40, type: 'lab' },
      { name: 'Auditorium', building: 'Admin Block', floor: 'G', capacity: 200, type: 'auditorium' },
      { name: 'Seminar Hall', building: 'Main Block', floor: '3', capacity: 80, type: 'seminar_hall' },
    ]);

    const trainers = await Trainer.insertMany([
      {
        employeeId: 'TRN001',
        name: 'Dr. Rajesh Kumar',
        email: 'rajesh.kumar@institute.edu',
        phone: '9876543210',
        department: departments[0]._id,
        skills: ['Java', 'Data Structures', 'Algorithms'],
        experience: 12,
        joiningDate: new Date('2018-06-01'),
        weeklyWorkloadHours: 18,
        performanceScore: 92,
      },
      {
        employeeId: 'TRN002',
        name: 'Prof. Anita Sharma',
        email: 'anita.sharma@institute.edu',
        phone: '9876543211',
        department: departments[0]._id,
        skills: ['Python', 'Machine Learning', 'AI'],
        experience: 8,
        joiningDate: new Date('2020-01-15'),
        weeklyWorkloadHours: 16,
        performanceScore: 88,
      },
      {
        employeeId: 'TRN003',
        name: 'Mr. Vikram Singh',
        email: 'vikram.singh@institute.edu',
        phone: '9876543212',
        department: departments[1]._id,
        skills: ['Electronics', 'VLSI', 'Embedded Systems'],
        experience: 10,
        joiningDate: new Date('2019-03-10'),
        weeklyWorkloadHours: 20,
        performanceScore: 85,
      },
    ]);

    const subjects = await Subject.insertMany([
      {
        name: 'Data Structures',
        code: 'CSE101',
        semester: semesters[0]._id,
        department: departments[0]._id,
        course: 'B.Tech CSE',
        hours: 4,
        trainerEligible: [trainers[0]._id, trainers[1]._id],
      },
      {
        name: 'Machine Learning',
        code: 'CSE201',
        semester: semesters[1]._id,
        department: departments[0]._id,
        course: 'B.Tech CSE',
        hours: 3,
        trainerEligible: [trainers[1]._id],
      },
      {
        name: 'Digital Electronics',
        code: 'ECE101',
        semester: semesters[0]._id,
        department: departments[1]._id,
        course: 'B.Tech ECE',
        hours: 4,
        trainerEligible: [trainers[2]._id],
      },
    ]);

    // Link subjects to trainers
    await Trainer.findByIdAndUpdate(trainers[0]._id, { subjects: [subjects[0]._id] });
    await Trainer.findByIdAndUpdate(trainers[1]._id, { subjects: [subjects[0]._id, subjects[1]._id] });
    await Trainer.findByIdAndUpdate(trainers[2]._id, { subjects: [subjects[2]._id] });

    await Student.insertMany([
      {
        rollNumber: 'CSE001',
        name: 'Arjun Mehta',
        email: 'arjun@student.edu',
        branch: 'CSE',
        section: sections[0]._id,
        semester: semesters[0]._id,
        batch: batches[0]._id,
      },
      {
        rollNumber: 'CSE002',
        name: 'Priya Nair',
        email: 'priya@student.edu',
        branch: 'CSE',
        section: sections[0]._id,
        semester: semesters[0]._id,
        batch: batches[0]._id,
      },
    ]);

    // Create users
    await User.create({
      name: 'System Admin',
      email: 'admin@toms.edu',
      password: 'admin123',
      role: 'admin',
    });

    await User.create({
      name: 'Campus Manager',
      email: 'manager@toms.edu',
      password: 'manager123',
      role: 'campus_manager',
    });

    await User.create({
      name: 'Dr. Rajesh Kumar',
      email: 'trainer@toms.edu',
      password: 'trainer123',
      role: 'trainer',
      trainer: trainers[0]._id,
    });

    // Sample schedules for the current week
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const dayOffset = today.getDay() === 0 ? 1 : 0; // skip Sunday if today is Sunday

    const makeSchedule = (daysFromToday, startTime, endTime, subject, trainer, venue, batch, semester) => {
      const date = new Date(today);
      date.setDate(date.getDate() + daysFromToday + dayOffset);
      const normalizedDate = normalizeDate(date);
      return {
        date: normalizedDate,
        startTime,
        endTime,
        startDateTime: combineDateAndTime(normalizedDate, startTime),
        endDateTime: combineDateAndTime(normalizedDate, endTime),
        subject,
        trainer,
        venue,
        batch,
        semester,
        status: 'scheduled',
      };
    };

    const insertedSchedules = await Schedule.insertMany([
      makeSchedule(0, '09:00', '10:30', subjects[0]._id, trainers[0]._id, venues[0]._id, batches[0]._id, semesters[0]._id),
      makeSchedule(0, '11:00', '12:30', subjects[1]._id, trainers[1]._id, venues[1]._id, batches[0]._id, semesters[1]._id),
      makeSchedule(1, '09:00', '10:30', subjects[0]._id, trainers[0]._id, venues[1]._id, batches[0]._id, semesters[0]._id),
      makeSchedule(1, '14:00', '15:30', subjects[2]._id, trainers[2]._id, venues[0]._id, batches[1]._id, semesters[0]._id),
      makeSchedule(2, '10:00', '11:30', subjects[1]._id, trainers[1]._id, venues[3]._id, batches[0]._id, semesters[1]._id),
      makeSchedule(3, '09:00', '10:30', subjects[0]._id, trainers[1]._id, venues[0]._id, batches[1]._id, semesters[0]._id),
      makeSchedule(4, '15:00', '16:30', subjects[2]._id, trainers[2]._id, venues[1]._id, batches[1]._id, semesters[0]._id),
    ]);

    const adminUser = await User.findOne({ email: 'admin@toms.edu' });
    const students = await Student.find();
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1 + dayOffset);

    await Leave.create({
      trainer: trainers[0]._id,
      startDate: normalizeDate(tomorrow),
      endDate: normalizeDate(tomorrow),
      reason: 'Medical appointment',
      status: 'pending',
      affectedSchedules: [insertedSchedules[2]._id],
      replacementNeeded: true,
    });

    await Attendance.insertMany([
      { type: 'trainer', trainer: trainers[0]._id, schedule: insertedSchedules[0]._id, date: normalizeDate(today), status: 'present', markedBy: adminUser._id },
      { type: 'trainer', trainer: trainers[1]._id, schedule: insertedSchedules[1]._id, date: normalizeDate(today), status: 'present', markedBy: adminUser._id },
      { type: 'trainer', trainer: trainers[2]._id, date: normalizeDate(today), status: 'late', remarks: 'Traffic delay', markedBy: adminUser._id },
      { type: 'student', student: students[0]._id, date: normalizeDate(today), status: 'present', markedBy: adminUser._id },
      { type: 'student', student: students[1]._id, date: normalizeDate(today), status: 'absent', remarks: 'Uninformed', markedBy: adminUser._id },
    ]);

    console.log('\n--- Seed completed successfully ---\n');
    console.log('Login credentials:');
    console.log('  Admin:   admin@toms.edu / admin123');
    console.log('  Manager: manager@toms.edu / manager123');
    console.log('  Trainer: trainer@toms.edu / trainer123');
    console.log('');

    process.exit(0);
  } catch (error) {
    console.error('Seed error:', error);
    process.exit(1);
  }
};

seed();
