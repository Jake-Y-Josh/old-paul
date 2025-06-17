/**
 * Admin Dashboard JavaScript
 */

$(document).ready(function() {
  // Auto-hide alerts after 5 seconds
  setTimeout(function() {
    $('.alert-dismissible').alert('close');
  }, 5000);

  // Set up form deletion confirmation
  $('.delete-confirm').on('click', function(e) {
    e.preventDefault();
    const url = $(this).data('url');
    const method = $(this).data('method') || 'DELETE';
    const itemName = $(this).data('name') || 'this item';
    
    if (confirm(`Are you sure you want to delete "${itemName}"? This action cannot be undone.`)) {
      // Show loading state
      $(this).html('<i class="fas fa-spinner fa-spin"></i>');
      $(this).attr('disabled', true);
      
      // Send DELETE request
      fetch(url, {
        method: method,
        headers: {
          'Content-Type': 'application/json'
        }
      })
      .then(response => response.json())
      .then(data => {
        if (data.success) {
          // Success - show message and remove row
          showToast('Success', data.message, 'success');
          // Remove the table row
          $(this).closest('tr').fadeOut(300, function() {
            $(this).remove();
            // If no more rows, show "no items" message
            if ($('table tbody tr').length === 0) {
              $('table').replaceWith('<div class="alert alert-info"><p>No items found.</p></div>');
            }
          });
        } else {
          // Error
          showToast('Error', data.message, 'danger');
          // Reset button
          $(this).html('<i class="fas fa-trash-alt"></i>');
          $(this).attr('disabled', false);
        }
      })
      .catch(error => {
        console.error('Error:', error);
        showToast('Error', 'An error occurred while processing your request.', 'danger');
        // Reset button
        $(this).html('<i class="fas fa-trash-alt"></i>');
        $(this).attr('disabled', false);
      });
    }
  });

  // Form submission with AJAX
  $('.ajax-form').on('submit', function(e) {
    e.preventDefault();
    
    const form = $(this);
    const url = form.attr('action');
    const method = form.attr('method') || 'POST';
    const formData = form.serialize();
    const submitBtn = form.find('button[type="submit"]');
    
    // Disable submit button and show loading state
    submitBtn.prop('disabled', true).html('<span class="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span> Processing...');
    
    $.ajax({
      url: url,
      type: method,
      data: formData,
      success: function(response) {
        if (response.success) {
          if (form.data('redirect')) {
            window.location.href = form.data('redirect');
          } else if (form.data('reload')) {
            window.location.reload();
          } else {
            // Show success message
            const successAlert = $('<div class="alert alert-success alert-dismissible fade show" role="alert"></div>')
              .text(response.message)
              .append('<button type="button" class="btn-close" data-bs-dismiss="alert" aria-label="Close"></button>');
            
            form.before(successAlert);
            form[0].reset();
            
            // Auto-hide the alert after 5 seconds
            setTimeout(function() {
              successAlert.alert('close');
            }, 5000);
          }
        } else {
          // Show error message
          const errorAlert = $('<div class="alert alert-danger alert-dismissible fade show" role="alert"></div>')
            .text(response.message)
            .append('<button type="button" class="btn-close" data-bs-dismiss="alert" aria-label="Close"></button>');
          
          form.before(errorAlert);
          
          // Auto-hide the alert after 5 seconds
          setTimeout(function() {
            errorAlert.alert('close');
          }, 5000);
        }
      },
      error: function(xhr) {
        const errorMessage = xhr.responseJSON ? xhr.responseJSON.message : 'An error occurred.';
        
        // Show error message
        const errorAlert = $('<div class="alert alert-danger alert-dismissible fade show" role="alert"></div>')
          .text('Error: ' + errorMessage)
          .append('<button type="button" class="btn-close" data-bs-dismiss="alert" aria-label="Close"></button>');
        
        form.before(errorAlert);
        
        // Auto-hide the alert after 5 seconds
        setTimeout(function() {
          errorAlert.alert('close');
        }, 5000);
      },
      complete: function() {
        // Re-enable submit button
        submitBtn.prop('disabled', false).text(submitBtn.data('original-text') || 'Submit');
      }
    });
  });

  // Save original button text for AJAX forms
  $('.ajax-form button[type="submit"]').each(function() {
    $(this).data('original-text', $(this).text());
  });
});

// Function to show toast notifications
function showToast(title, message, type) {
  // If we have a toast container, use it
  if ($('#toast-container').length === 0) {
    $('body').append(`
      <div id="toast-container" class="position-fixed bottom-0 end-0 p-3" style="z-index: 9999">
      </div>
    `);
  }
  
  const toastId = 'toast-' + Date.now();
  const toast = `
    <div id="${toastId}" class="toast align-items-center text-white bg-${type} border-0" role="alert" aria-live="assertive" aria-atomic="true">
      <div class="d-flex">
        <div class="toast-body">
          <strong>${title}:</strong> ${message}
        </div>
        <button type="button" class="btn-close btn-close-white me-2 m-auto" data-bs-dismiss="toast" aria-label="Close"></button>
      </div>
    </div>
  `;
  
  $('#toast-container').append(toast);
  const toastElement = new bootstrap.Toast(document.getElementById(toastId), { delay: 5000 });
  toastElement.show();
} 