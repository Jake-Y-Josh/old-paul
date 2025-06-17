const Form = require('../models/form');
const Submission = require('../models/submission');

/**
 * Form Controller
 */

// List all feedback forms
const listForms = async (req, res) => {
  try {
    const forms = await Form.getAll();
    
    res.render('admin/forms/list', {
      title: 'Feedback Forms',
      forms,
      success: req.query.success,
      error: req.query.error,
      username: req.session.username,
      layout: 'layouts/admin'
    });
  } catch (error) {
    console.error('Error listing forms:', error);
    res.render('error', { 
      message: 'Failed to load feedback forms',
      error,
      layout: false
    });
  }
};

// Render form creation page
const createFormPage = (req, res) => {
  res.render('admin/forms/create', {
    title: 'Create Feedback Form',
    username: req.session.username,
    layout: 'layouts/admin'
  });
};

// Process form creation
const createForm = async (req, res) => {
  try {
    const formData = req.body;
    
    // Validate required fields
    if (!formData.title || !formData.questions || !Array.isArray(formData.questions) || formData.questions.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Title and at least one question are required'
      });
    }
    
    // Handle multi-step form data
    if (formData.isMultiStep && formData.steps) {
      // Ensure each question has a step assigned
      formData.questions.forEach(question => {
        if (question.step === undefined) {
          question.step = 0;
        }
      });
    }
    
    // Create the form
    const form = await Form.create(formData, req.session.adminId);
    
    res.status(201).json({
      success: true,
      message: 'Feedback form created successfully',
      form
    });
  } catch (error) {
    console.error('Error creating form:', error);
    res.status(500).json({
      success: false,
      message: 'An error occurred while creating the form'
    });
  }
};

// Render form edit page
const editFormPage = async (req, res) => {
  try {
    const { id } = req.params;
    const form = await Form.getById(id);
    
    if (!form) {
      return res.redirect('/admin/forms?error=Form not found');
    }
    
    res.render('admin/forms/edit', {
      title: 'Edit Feedback Form',
      form,
      username: req.session.username,
      layout: 'layouts/admin'
    });
  } catch (error) {
    console.error('Form edit page error:', error);
    res.render('error', { 
      message: 'Failed to load form editor',
      error,
      layout: false 
    });
  }
};

// Process form update
const updateForm = async (req, res) => {
  try {
    const { id } = req.params;
    const formData = req.body;
    
    // Validate required fields
    if (!formData.title || !formData.questions || !Array.isArray(formData.questions) || formData.questions.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Title and at least one question are required'
      });
    }
    
    // Handle multi-step form data
    if (formData.isMultiStep && formData.steps) {
      // Ensure each question has a step assigned
      formData.questions.forEach(question => {
        if (question.step === undefined) {
          question.step = 0;
        }
      });
    }
    
    // Check if form exists
    const existingForm = await Form.getById(id);
    
    if (!existingForm) {
      return res.status(404).json({
        success: false,
        message: 'Feedback form not found'
      });
    }
    
    // Update the form
    const form = await Form.update(id, formData);
    
    res.status(200).json({
      success: true,
      message: 'Feedback form updated successfully',
      form
    });
  } catch (error) {
    console.error('Form update error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update feedback form',
      error: error.message
    });
  }
};

// Delete a form
const deleteForm = async (req, res) => {
  try {
    const { id } = req.params;
    
    // Check if form exists
    const existingForm = await Form.getById(id);
    
    if (!existingForm) {
      return res.status(404).json({
        success: false,
        message: 'Feedback form not found'
      });
    }
    
    // Delete the form
    await Form.delete(id);
    
    res.status(200).json({
      success: true,
      message: 'Feedback form deleted successfully'
    });
  } catch (error) {
    console.error('Form deletion error:', error);
    
    // Handle case when form has submissions
    if (error.message && error.message.includes('associated submissions')) {
      return res.status(400).json({
        success: false,
        message: error.message
      });
    }
    
    res.status(500).json({
      success: false,
      message: 'Failed to delete feedback form. Please try again.'
    });
  }
};

// View form submissions
const viewSubmissions = async (req, res) => {
  try {
    const { id } = req.params;
    
    // Check if form exists
    const form = await Form.getById(id);
    
    if (!form) {
      return res.redirect('/admin/forms?error=Form not found');
    }
    
    // Get submissions for this form
    const submissions = await Submission.getByFormId(id);
    
    res.render('admin/forms/submissions', {
      title: `Submissions for ${form.title}`,
      form,
      submissions,
      username: req.session.username,
      layout: 'layouts/admin'
    });
  } catch (error) {
    console.error('Form submissions error:', error);
    res.render('error', { 
      message: 'Failed to load form submissions',
      error,
      layout: false
    });
  }
};

module.exports = {
  listForms,
  createFormPage,
  createForm,
  editFormPage,
  updateForm,
  deleteForm,
  viewSubmissions
}; 